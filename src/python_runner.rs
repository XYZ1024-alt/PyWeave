use std::ffi::CString;

use pyo3::prelude::*;
use pyo3::types::PyDict;

use crate::tracer::{TraceCollector, TraceEvent};

const ALGORITHM_FILE: &str = "<pyweave_algorithm>";
const TARGET_FUNCTION: &str = "traced_selection_sort";
const SORT_INPUT_LITERAL: &str = "[5, 3, 4, 1, 2]";

const ALGORITHM_TEMPLATE: &str = r#"
def traced_selection_sort(values):
    items = list(values)
    size = len(items)
    for index in range(size):
        min_index = index
        for candidate in range(index + 1, size):
            if items[candidate] < items[min_index]:
                min_index = candidate
        if min_index != index:
            items[index], items[min_index] = items[min_index], items[index]
    return items

input_values = {input_values}
sorted_values = traced_selection_sort(input_values)
"#;

const DRIVER_SCRIPT: &str = r#"
import sys

def _trace(frame, event, arg):
    _trace_collector.record(frame, event, arg)
    return _trace

sys.settrace(_trace)
try:
    exec(_compiled_algorithm, _algorithm_globals)
finally:
    sys.settrace(None)
"#;

pub fn run_sort_trace() -> PyResult<Vec<TraceEvent>> {
    Python::attach(|py| {
        let collector = Py::new(py, TraceCollector::new(TARGET_FUNCTION))?;
        let globals = create_driver_globals(py, &collector)?;
        let algorithm_globals = create_algorithm_globals(py)?;
        let compiled = compile_algorithm(py)?;

        globals.set_item("_compiled_algorithm", compiled)?;
        globals.set_item("_algorithm_globals", algorithm_globals)?;
        run_driver(py, &globals)?;

        Ok(collector.borrow(py).events().to_vec())
    })
}

fn compile_algorithm(py: Python<'_>) -> PyResult<Bound<'_, PyAny>> {
    let builtins = py.import("builtins")?;
    let compile = builtins.getattr("compile")?;
    let source = ALGORITHM_TEMPLATE.replace("{input_values}", SORT_INPUT_LITERAL);

    compile.call1((source, ALGORITHM_FILE, "exec"))
}

fn create_driver_globals<'py>(
    py: Python<'py>,
    collector: &Py<TraceCollector>,
) -> PyResult<Bound<'py, PyDict>> {
    let globals = PyDict::new(py);
    globals.set_item("__builtins__", py.import("builtins")?)?;
    globals.set_item("_trace_collector", collector)?;
    Ok(globals)
}

fn create_algorithm_globals(py: Python<'_>) -> PyResult<Bound<'_, PyDict>> {
    let globals = PyDict::new(py);
    globals.set_item("__builtins__", py.import("builtins")?)?;
    Ok(globals)
}

fn run_driver(py: Python<'_>, globals: &Bound<'_, PyDict>) -> PyResult<()> {
    let driver = CString::new(DRIVER_SCRIPT)?;
    py.run(driver.as_c_str(), Some(globals), Some(globals))
}
