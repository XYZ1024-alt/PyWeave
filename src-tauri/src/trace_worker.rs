use std::env;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use pyo3::Python;
use serde::{Deserialize, Serialize};

use crate::error::TraceExecutionError;
use crate::python_runner;
use crate::tracer::TraceRun;

pub const TRACE_WORKER_ARG: &str = "--pyweave-trace-worker";
pub const TRACE_TIMEOUT_ENV: &str = "PYWEAVE_TRACE_TIMEOUT_MS";
pub const TRACE_WORKER_EXE_ENV: &str = "PYWEAVE_TRACE_WORKER_EXE";

const DEFAULT_TRACE_TIMEOUT_MS: u64 = 5_000;
const WAIT_POLL_INTERVAL_MS: u64 = 10;
const TEMP_FILE_STEM: &str = "pyweave-trace-worker";

#[derive(Debug)]
pub struct TraceWorkerConfig {
    executable: PathBuf,
    timeout: Option<Duration>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TraceWorkerRequest {
    python_code: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", tag = "status", content = "payload")]
enum TraceWorkerResponse {
    Ok(TraceRun),
    Error(TraceExecutionError),
}

struct WorkerOutputFiles {
    stdout_path: PathBuf,
    stderr_path: PathBuf,
}

pub fn run_python_trace_in_subprocess(source: &str) -> Result<TraceRun, TraceExecutionError> {
    let config = TraceWorkerConfig::from_environment()?;
    let response = run_trace_worker_process(source, &config)?;

    match response {
        TraceWorkerResponse::Ok(trace_run) => Ok(trace_run),
        TraceWorkerResponse::Error(error) => Err(error),
    }
}

pub fn run_worker_from_stdio() -> i32 {
    match handle_worker_stdio(io::stdin().lock(), io::stdout().lock()) {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("{}: {}", error.kind, error.message);
            2
        }
    }
}

pub fn worker_requested() -> bool {
    env::args().any(|arg| arg == TRACE_WORKER_ARG)
}

impl TraceWorkerConfig {
    fn from_environment() -> Result<Self, TraceExecutionError> {
        Ok(Self {
            executable: worker_executable()?,
            timeout: trace_timeout()?,
        })
    }
}

fn run_trace_worker_process(
    source: &str,
    config: &TraceWorkerConfig,
) -> Result<TraceWorkerResponse, TraceExecutionError> {
    let files = WorkerOutputFiles::create()?;
    let mut child = spawn_worker(config, &files)?;

    write_worker_request(&mut child, source)?;
    let status = wait_for_worker(&mut child, config.timeout)?;
    let stdout = files.read_stdout()?;
    let stderr = files.read_stderr()?;

    validate_worker_status(status, &stderr)?;
    parse_worker_response(&stdout)
}

fn handle_worker_stdio(
    mut input: impl Read,
    mut output: impl Write,
) -> Result<(), TraceExecutionError> {
    let request: TraceWorkerRequest = serde_json::from_reader(&mut input)
        .map_err(|error| TraceExecutionError::new("WorkerProtocolError", error.to_string()))?;
    let response = trace_worker_response(&request.python_code);

    serde_json::to_writer(&mut output, &response)
        .map_err(|error| TraceExecutionError::new("WorkerProtocolError", error.to_string()))?;
    output
        .write_all(b"\n")
        .map_err(|error| TraceExecutionError::new("WorkerProtocolError", error.to_string()))
}

fn trace_worker_response(source: &str) -> TraceWorkerResponse {
    Python::initialize();
    Python::attach(|py| match python_runner::run_python_trace(source) {
        Ok(trace_run) => TraceWorkerResponse::Ok(trace_run),
        Err(error) => TraceWorkerResponse::Error(TraceExecutionError::from_py_err(py, error)),
    })
}

fn worker_executable() -> Result<PathBuf, TraceExecutionError> {
    if let Some(value) = env::var_os(TRACE_WORKER_EXE_ENV) {
        return Ok(PathBuf::from(value));
    }

    env::current_exe()
        .map_err(|error| TraceExecutionError::new("WorkerConfigError", error.to_string()))
}

fn trace_timeout() -> Result<Option<Duration>, TraceExecutionError> {
    let Ok(value) = env::var(TRACE_TIMEOUT_ENV) else {
        return Ok(Some(Duration::from_millis(DEFAULT_TRACE_TIMEOUT_MS)));
    };
    let timeout_ms = value.parse::<u64>().map_err(|error| {
        TraceExecutionError::new(
            "WorkerConfigError",
            format!("{TRACE_TIMEOUT_ENV} must be an integer: {error}"),
        )
    })?;

    Ok((timeout_ms > 0).then_some(Duration::from_millis(timeout_ms)))
}

fn spawn_worker(
    config: &TraceWorkerConfig,
    files: &WorkerOutputFiles,
) -> Result<Child, TraceExecutionError> {
    let stdout = File::create(&files.stdout_path)
        .map_err(|error| TraceExecutionError::new("WorkerProcessError", error.to_string()))?;
    let stderr = File::create(&files.stderr_path)
        .map_err(|error| TraceExecutionError::new("WorkerProcessError", error.to_string()))?;

    Command::new(&config.executable)
        .arg(TRACE_WORKER_ARG)
        .stdin(Stdio::piped())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
        .map_err(|error| TraceExecutionError::new("WorkerProcessError", error.to_string()))
}

fn write_worker_request(child: &mut Child, source: &str) -> Result<(), TraceExecutionError> {
    let request = TraceWorkerRequest {
        python_code: source.to_owned(),
    };
    let mut stdin = child.stdin.take().ok_or_else(|| {
        TraceExecutionError::new("WorkerProcessError", "worker stdin was not available")
    })?;

    serde_json::to_writer(&mut stdin, &request)
        .map_err(|error| TraceExecutionError::new("WorkerProtocolError", error.to_string()))?;
    stdin
        .write_all(b"\n")
        .map_err(|error| TraceExecutionError::new("WorkerProcessError", error.to_string()))
}

fn wait_for_worker(
    child: &mut Child,
    timeout: Option<Duration>,
) -> Result<ExitStatus, TraceExecutionError> {
    let started_at = Instant::now();

    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| TraceExecutionError::new("WorkerProcessError", error.to_string()))?
        {
            return Ok(status);
        }

        if timed_out(started_at, timeout) {
            return kill_timed_out_worker(child, timeout);
        }

        thread::sleep(Duration::from_millis(WAIT_POLL_INTERVAL_MS));
    }
}

fn timed_out(started_at: Instant, timeout: Option<Duration>) -> bool {
    timeout.is_some_and(|duration| started_at.elapsed() >= duration)
}

fn kill_timed_out_worker(
    child: &mut Child,
    timeout: Option<Duration>,
) -> Result<ExitStatus, TraceExecutionError> {
    child
        .kill()
        .map_err(|error| TraceExecutionError::new("WorkerTimeout", error.to_string()))?;
    let _ = child.wait();
    let timeout_ms = timeout.map(|duration| duration.as_millis()).unwrap_or(0);

    Err(TraceExecutionError::new(
        "WorkerTimeout",
        format!("Python trace worker exceeded {timeout_ms} ms and was terminated"),
    ))
}

fn validate_worker_status(status: ExitStatus, stderr: &str) -> Result<(), TraceExecutionError> {
    if status.success() {
        return Ok(());
    }

    let message = if stderr.trim().is_empty() {
        format!("trace worker exited with {status}")
    } else {
        format!("trace worker exited with {status}: {}", stderr.trim())
    };
    Err(TraceExecutionError::new("WorkerProcessError", message))
}

fn parse_worker_response(stdout: &str) -> Result<TraceWorkerResponse, TraceExecutionError> {
    serde_json::from_str(stdout)
        .map_err(|error| TraceExecutionError::new("WorkerProtocolError", error.to_string()))
}

impl WorkerOutputFiles {
    fn create() -> Result<Self, TraceExecutionError> {
        let output = Self {
            stdout_path: temp_file_path("stdout")?,
            stderr_path: temp_file_path("stderr")?,
        };

        Ok(output)
    }

    fn read_stdout(&self) -> Result<String, TraceExecutionError> {
        read_output_file(&self.stdout_path)
    }

    fn read_stderr(&self) -> Result<String, TraceExecutionError> {
        read_output_file(&self.stderr_path)
    }
}

impl Drop for WorkerOutputFiles {
    fn drop(&mut self) {
        report_cleanup_error(fs::remove_file(&self.stdout_path), &self.stdout_path);
        report_cleanup_error(fs::remove_file(&self.stderr_path), &self.stderr_path);
    }
}

fn temp_file_path(suffix: &str) -> Result<PathBuf, TraceExecutionError> {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| TraceExecutionError::new("WorkerProcessError", error.to_string()))?
        .as_nanos();
    Ok(env::temp_dir().join(format!(
        "{TEMP_FILE_STEM}-{}-{unique}-{suffix}.json",
        std::process::id()
    )))
}

fn read_output_file(path: &PathBuf) -> Result<String, TraceExecutionError> {
    fs::read_to_string(path)
        .map_err(|error| TraceExecutionError::new("WorkerProcessError", error.to_string()))
}

fn report_cleanup_error(result: io::Result<()>, path: &PathBuf) {
    if let Err(error) = result {
        eprintln!("failed to remove trace worker file {}: {error}", path.display());
    }
}

#[cfg(test)]
mod tests {
    use std::process::{Command, Stdio};
    use std::time::Duration;

    use super::{validate_worker_status, wait_for_worker};

    #[test]
    fn kills_worker_after_timeout() {
        let mut child = sleep_command(1_000)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("sleep fixture should start");

        let error = wait_for_worker(&mut child, Some(Duration::from_millis(20)))
            .expect_err("timeout should terminate worker");

        assert_eq!(error.kind, "WorkerTimeout");
        assert!(error.message.contains("terminated"));
    }

    #[test]
    fn reports_nonzero_worker_exit() {
        let status = failing_command()
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .expect("failure fixture should exit");

        let error = validate_worker_status(status, "intentional failure")
            .expect_err("nonzero status should be rejected");

        assert_eq!(error.kind, "WorkerProcessError");
        assert!(error.message.contains("intentional failure"));
    }

    #[cfg(windows)]
    fn sleep_command(milliseconds: u64) -> Command {
        let mut command = Command::new("powershell");
        command.args(["-NoProfile", "-Command"]);
        command.arg(format!("Start-Sleep -Milliseconds {milliseconds}"));
        command
    }

    #[cfg(not(windows))]
    fn sleep_command(milliseconds: u64) -> Command {
        let mut command = Command::new("sh");
        command
            .arg("-c")
            .arg(format!("sleep {}", milliseconds / 1000));
        command
    }

    #[cfg(windows)]
    fn failing_command() -> Command {
        let mut command = Command::new("powershell");
        command.args(["-NoProfile", "-Command", "exit 7"]);
        command
    }

    #[cfg(not(windows))]
    fn failing_command() -> Command {
        let mut command = Command::new("sh");
        command.arg("-c").arg("exit 7");
        command
    }
}
