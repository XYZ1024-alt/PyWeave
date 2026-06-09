mod error;
mod python_policy;
mod python_runner;
mod python_value;
mod tracer;

use error::TraceExecutionError;
use tracer::TraceEvent;

#[tauri::command]
fn trace_sort_algorithm(python_code: String) -> Result<Vec<TraceEvent>, TraceExecutionError> {
    pyo3::Python::initialize();
    let timeline = python_runner::run_sort_trace(&python_code)
        .map_err(|error| pyo3::Python::attach(|py| TraceExecutionError::from_py_err(py, error)))?;
    println!("trace_sort_algorithm returned {} states", timeline.len());
    Ok(timeline)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![trace_sort_algorithm])
        .run(tauri::generate_context!())
        .expect("failed to run PyWeave Tauri application");
}

#[cfg(test)]
mod tests {
    use super::trace_sort_algorithm;

    #[test]
    fn command_formats_syntax_error() {
        let error = trace_sort_algorithm("x =\n".to_owned()).unwrap_err();

        assert_eq!(error.kind, "SyntaxError");
        assert_eq!(error.line, Some(1));
        assert!(error.message.contains("invalid syntax"));
    }

    #[test]
    fn command_formats_runtime_error() {
        let source = "items = [1]\nboom = items[3]\n";
        let error = trace_sort_algorithm(source.to_owned()).unwrap_err();

        assert_eq!(error.kind, "IndexError");
        assert_eq!(error.line, Some(2));
        assert!(error.message.contains("list index out of range"));
    }

    #[test]
    fn command_formats_policy_error_line() {
        let source = "items = [1]\nimport os\n";
        let error = trace_sort_algorithm(source.to_owned()).unwrap_err();

        assert_eq!(error.kind, "ValueError");
        assert_eq!(error.line, Some(2));
        assert!(error.message.contains("PyWeave policy rejected line 2"));
    }

    #[test]
    fn command_formats_trace_limit_error() {
        let source = "i = 0\nwhile True:\n    i = i + 1\n";
        let error = trace_sort_algorithm(source.to_owned()).unwrap_err();

        assert_eq!(error.kind, "RuntimeError");
        assert_eq!(error.line, Some(3));
        assert!(error.message.contains("Trace snapshot limit exceeded"));
    }
}
