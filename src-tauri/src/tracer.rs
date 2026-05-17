use std::collections::BTreeMap;

use pyo3::exceptions::PyRuntimeError;
use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde::Serialize;
use serde_json::Value;

use crate::python_value::to_json_value;

pub const MAX_TRACE_EVENTS: usize = 1000;

#[derive(Clone, Debug, Serialize)]
pub struct TraceEvent {
    pub line: usize,
    pub locals: BTreeMap<String, Value>,
}

#[pyclass]
pub struct TraceCollector {
    events: Vec<TraceEvent>,
    target_filename: String,
}

#[pymethods]
impl TraceCollector {
    #[new]
    pub fn new(target_filename: &str) -> Self {
        Self {
            events: Vec::new(),
            target_filename: target_filename.to_owned(),
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

        if self.events.len() >= MAX_TRACE_EVENTS {
            return Err(PyRuntimeError::new_err(format!(
                "Trace snapshot limit exceeded: {MAX_TRACE_EVENTS} frames"
            )));
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
        let filename: String = code.getattr("co_filename")?.extract()?;
        Ok(filename == self.target_filename)
    }
}

fn copy_locals(frame: &Bound<'_, PyAny>) -> PyResult<BTreeMap<String, Value>> {
    let py = frame.py();
    let locals = frame.getattr("f_locals")?;
    let deepcopy = py.import("copy")?.getattr("deepcopy")?;
    let dict = locals.cast::<PyDict>()?;
    let mut output = BTreeMap::new();

    for (key, value) in dict.iter() {
        let name = key.extract::<String>()?;

        if should_skip_local(&name, &value)? {
            continue;
        }

        let copied = deepcopy.call1((&value,))?;
        output.insert(name, to_json_value(&copied)?);
    }

    Ok(output)
}

fn should_skip_local(name: &str, value: &Bound<'_, PyAny>) -> PyResult<bool> {
    if name.starts_with("__") {
        return Ok(true);
    }

    if value
        .py()
        .import("builtins")?
        .getattr("callable")?
        .call1((value,))?
        .extract()?
    {
        return Ok(true);
    }

    value
        .py()
        .import("inspect")?
        .getattr("ismodule")?
        .call1((value,))?
        .extract()
}
