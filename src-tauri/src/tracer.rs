use std::collections::BTreeMap;
use std::env;

use pyo3::exceptions::PyRuntimeError;
use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde::Serialize;
use serde_json::Value;

use crate::python_value::to_json_value;

pub const MAX_TRACE_EVENTS: usize = 1000;
const DEFAULT_MAX_SNAPSHOT_BYTES: usize = 262_144;
const SNAPSHOT_LIMIT_ENV: &str = "PYWEAVE_MAX_SNAPSHOT_BYTES";

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

        let locals = copy_locals(frame)?;
        enforce_snapshot_size(&locals)?;

        self.events.push(TraceEvent {
            line: frame.getattr("f_lineno")?.extract()?,
            locals,
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

        let visualized = match deepcopy.call1((&value,)) {
            Ok(copied) => visualizable_value(&copied)?,
            Err(error) => unsupported_value(&value, &error)?,
        };
        output.insert(name, visualized);
    }

    Ok(output)
}

fn visualizable_value(value: &Bound<'_, PyAny>) -> PyResult<Value> {
    match to_json_value(value) {
        Ok(json) => Ok(json),
        Err(error) => unsupported_value(value, &error),
    }
}

fn unsupported_value(value: &Bound<'_, PyAny>, error: &PyErr) -> PyResult<Value> {
    let type_name = value.get_type().name()?.to_string();
    Ok(Value::String(format!(
        "<unsupported {type_name}: {error}>"
    )))
}

fn enforce_snapshot_size(locals: &BTreeMap<String, Value>) -> PyResult<()> {
    let Some(limit) = snapshot_byte_limit()? else {
        return Ok(());
    };
    let bytes = serde_json::to_vec(locals)
        .map_err(|error| PyRuntimeError::new_err(error.to_string()))?
        .len();

    if bytes <= limit {
        return Ok(());
    }

    Err(PyRuntimeError::new_err(format!(
        "Trace local snapshot exceeded {limit} bytes: {bytes} bytes"
    )))
}

fn snapshot_byte_limit() -> PyResult<Option<usize>> {
    let Ok(value) = env::var(SNAPSHOT_LIMIT_ENV) else {
        return Ok(Some(DEFAULT_MAX_SNAPSHOT_BYTES));
    };

    let limit = value.parse::<usize>().map_err(|error| {
        PyRuntimeError::new_err(format!("{SNAPSHOT_LIMIT_ENV} must be an integer: {error}"))
    })?;

    Ok((limit > 0).then_some(limit))
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
