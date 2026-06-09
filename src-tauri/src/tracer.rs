use std::collections::BTreeMap;
use std::env;

use pyo3::exceptions::PyRuntimeError;
use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::python_value::to_json_value;

pub const MAX_TRACE_EVENTS: usize = 1000;
const DEFAULT_MAX_SNAPSHOT_BYTES: usize = 262_144;
const SNAPSHOT_LIMIT_ENV: &str = "PYWEAVE_MAX_SNAPSHOT_BYTES";
const CAPTURED_EVENTS: &[&str] = &["line", "return"];

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceLine {
    pub number: usize,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceFrame {
    pub step: usize,
    pub event: String,
    pub line: usize,
    pub line_text: String,
    pub scope_name: String,
    pub call_depth: usize,
    pub locals: BTreeMap<String, Value>,
    pub return_value: Option<Value>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceRun {
    pub source_lines: Vec<SourceLine>,
    pub frames: Vec<TraceFrame>,
}

#[pyclass]
pub struct TraceCollector {
    frames: Vec<TraceFrame>,
    source_lines: Vec<SourceLine>,
    target_filename: String,
}

#[pymethods]
impl TraceCollector {
    #[new]
    pub fn new(target_filename: &str, source: &str) -> Self {
        Self {
            frames: Vec::new(),
            source_lines: source_lines(source),
            target_filename: target_filename.to_owned(),
        }
    }

    pub fn record(
        &mut self,
        frame: &Bound<'_, PyAny>,
        event: &str,
        arg: &Bound<'_, PyAny>,
    ) -> PyResult<()> {
        if !self.should_capture(frame, event)? {
            return Ok(());
        }

        if self.frames.len() >= MAX_TRACE_EVENTS {
            return Err(PyRuntimeError::new_err(format!(
                "Trace snapshot limit exceeded: {MAX_TRACE_EVENTS} frames"
            )));
        }

        let locals = copy_locals(frame)?;
        let return_value = return_value(event, arg)?;
        enforce_snapshot_size(&locals, &return_value)?;
        let line = frame.getattr("f_lineno")?.extract()?;

        self.frames.push(TraceFrame {
            step: self.frames.len(),
            event: event.to_owned(),
            line,
            line_text: self.line_text(line),
            scope_name: scope_name(frame)?,
            call_depth: call_depth(frame, &self.target_filename)?,
            locals,
            return_value,
        });

        Ok(())
    }
}

impl TraceCollector {
    pub fn frames(&self) -> &[TraceFrame] {
        &self.frames
    }

    fn should_capture(&self, frame: &Bound<'_, PyAny>, event: &str) -> PyResult<bool> {
        if !CAPTURED_EVENTS.contains(&event) {
            return Ok(false);
        }

        let code = frame.getattr("f_code")?;
        let filename: String = code.getattr("co_filename")?.extract()?;
        Ok(filename == self.target_filename)
    }

    fn line_text(&self, line: usize) -> String {
        self.source_lines
            .get(line.saturating_sub(1))
            .map(|source_line| source_line.text.clone())
            .unwrap_or_default()
    }
}

pub fn source_lines(source: &str) -> Vec<SourceLine> {
    source
        .lines()
        .enumerate()
        .map(|(index, text)| SourceLine {
            number: index + 1,
            text: text.to_owned(),
        })
        .collect()
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

fn scope_name(frame: &Bound<'_, PyAny>) -> PyResult<String> {
    frame.getattr("f_code")?.getattr("co_name")?.extract()
}

fn call_depth(frame: &Bound<'_, PyAny>, target_filename: &str) -> PyResult<usize> {
    let mut depth = 0;
    let mut current = frame.getattr("f_back")?;

    while !current.is_none() {
        if is_target_frame(&current, target_filename)? {
            depth += 1;
        }

        current = current.getattr("f_back")?;
    }

    Ok(depth)
}

fn is_target_frame(frame: &Bound<'_, PyAny>, target_filename: &str) -> PyResult<bool> {
    let filename: String = frame.getattr("f_code")?.getattr("co_filename")?.extract()?;
    Ok(filename == target_filename)
}

fn visualizable_value(value: &Bound<'_, PyAny>) -> PyResult<Value> {
    match to_json_value(value) {
        Ok(json) => Ok(json),
        Err(error) => unsupported_value(value, &error),
    }
}

fn unsupported_value(value: &Bound<'_, PyAny>, error: &PyErr) -> PyResult<Value> {
    let type_name = value.get_type().name()?.to_string();
    Ok(Value::String(format!("<unsupported {type_name}: {error}>")))
}

fn return_value(event: &str, arg: &Bound<'_, PyAny>) -> PyResult<Option<Value>> {
    if event != "return" {
        return Ok(None);
    }

    Ok(Some(visualizable_value(arg)?))
}

fn enforce_snapshot_size(
    locals: &BTreeMap<String, Value>,
    return_value: &Option<Value>,
) -> PyResult<()> {
    let Some(limit) = snapshot_byte_limit()? else {
        return Ok(());
    };
    let bytes = serde_json::to_vec(&TraceSnapshot {
        locals,
        return_value,
    })
    .map_err(|error| PyRuntimeError::new_err(error.to_string()))?
    .len();

    if bytes <= limit {
        return Ok(());
    }

    Err(PyRuntimeError::new_err(format!(
        "Trace local snapshot exceeded {limit} bytes: {bytes} bytes"
    )))
}

#[derive(Serialize)]
struct TraceSnapshot<'a> {
    locals: &'a BTreeMap<String, Value>,
    return_value: &'a Option<Value>,
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
