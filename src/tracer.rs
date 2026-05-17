use std::collections::BTreeMap;

use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde::Serialize;
use serde_json::Value;

use crate::python_value::to_json_value;

#[derive(Clone, Debug, Serialize)]
pub struct TraceEvent {
    pub line: usize,
    pub locals: BTreeMap<String, Value>,
}

#[pyclass]
pub struct TraceCollector {
    events: Vec<TraceEvent>,
    target_function: String,
}

#[pymethods]
impl TraceCollector {
    #[new]
    pub fn new(target_function: &str) -> Self {
        Self {
            events: Vec::new(),
            target_function: target_function.to_owned(),
        }
    }

    pub fn record(
        &mut self,
        frame: &Bound<'_, PyAny>,
        event: &str,
        _arg: &Bound<'_, PyAny>,
    ) -> PyResult<()> {
        if !self.should_capture(frame, event)? {
            return Ok(());
        }

        self.events.push(TraceEvent {
            line: frame.getattr("f_lineno")?.extract()?,
            locals: copy_locals(frame)?,
        });

        Ok(())
    }
}

impl TraceCollector {
    pub fn events(&self) -> &[TraceEvent] {
        &self.events
    }

    fn should_capture(&self, frame: &Bound<'_, PyAny>, event: &str) -> PyResult<bool> {
        if event != "line" {
            return Ok(false);
        }

        let code = frame.getattr("f_code")?;
        let function_name: String = code.getattr("co_name")?.extract()?;
        Ok(function_name == self.target_function)
    }
}

fn copy_locals(frame: &Bound<'_, PyAny>) -> PyResult<BTreeMap<String, Value>> {
    let py = frame.py();
    let locals = frame.getattr("f_locals")?;
    let copied = py.import("copy")?.getattr("deepcopy")?.call1((&locals,))?;
    let dict = copied.cast::<PyDict>()?;
    let mut output = BTreeMap::new();

    for (key, value) in dict.iter() {
        output.insert(key.extract::<String>()?, to_json_value(&value)?);
    }

    Ok(output)
}
