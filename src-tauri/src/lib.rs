mod error;
mod python_policy;
mod python_runner;
mod python_value;
#[cfg_attr(test, allow(dead_code))]
mod trace_worker;
mod tracer;

use error::TraceExecutionError;
use tracer::TraceRun;

#[tauri::command]
fn trace_python_code(python_code: String) -> Result<TraceRun, TraceExecutionError> {
    run_trace_command(&python_code)
}

#[cfg(not(test))]
fn run_trace_command(python_code: &str) -> Result<TraceRun, TraceExecutionError> {
    trace_worker::run_python_trace_in_subprocess(python_code)
}

#[cfg(test)]
fn run_trace_command(python_code: &str) -> Result<TraceRun, TraceExecutionError> {
    pyo3::Python::initialize();
    python_runner::run_python_trace(python_code)
        .map_err(|error| pyo3::Python::attach(|py| TraceExecutionError::from_py_err(py, error)))
}

pub fn run() {
    if trace_worker::worker_requested() {
        std::process::exit(trace_worker::run_worker_from_stdio());
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![trace_python_code])
        .run(tauri::generate_context!())
        .expect("failed to run PyWeave Tauri application");
}

#[cfg(test)]
mod tests {
    use super::trace_python_code;

    #[test]
    fn command_formats_syntax_error() {
        let error = trace_python_code("x =\n".to_owned()).unwrap_err();

        assert_eq!(error.kind, "SyntaxError");
        assert_eq!(error.line, Some(1));
        assert!(error.message.contains("invalid syntax"));
    }

    #[test]
    fn command_formats_runtime_error() {
        let source = "items = [1]\nboom = items[3]\n";
        let error = trace_python_code(source.to_owned()).unwrap_err();

        assert_eq!(error.kind, "IndexError");
        assert_eq!(error.line, Some(2));
        assert!(error.message.contains("list index out of range"));
    }

    #[test]
    fn command_formats_policy_error_line() {
        let source = "items = [1]\nimport os\n";
        let error = trace_python_code(source.to_owned()).unwrap_err();

        assert_eq!(error.kind, "ValueError");
        assert_eq!(error.line, Some(2));
        assert!(error.message.contains("PyWeave policy rejected line 2"));
    }

    #[test]
    fn command_formats_trace_limit_error() {
        let source = "i = 0\nwhile True:\n    i = i + 1\n";
        let error = trace_python_code(source.to_owned()).unwrap_err();

        assert_eq!(error.kind, "RuntimeError");
        assert_eq!(error.line, Some(3));
        assert!(error.message.contains("Trace snapshot limit exceeded"));
    }
}
