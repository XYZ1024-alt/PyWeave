use std::env;

use pyo3::exceptions::{PyRuntimeError, PyTypeError, PyValueError};
use pyo3::prelude::*;
use pyo3::types::{PyBool, PyDict, PyFloat, PyList, PyString, PyTuple};
use serde_json::{Map, Number, Value};

pub const VALUE_PREVIEW_ITEMS_ENV: &str = "PYWEAVE_VALUE_PREVIEW_ITEMS";
const DEFAULT_VALUE_PREVIEW_ITEMS: usize = 96;
const MIN_HEAD_AND_TAIL_PREVIEW_ITEMS: usize = 2;
const MIN_TAIL_PREVIEW_ITEMS: usize = 1;
const PREVIEW_TAIL_DIVISOR: usize = 3;
const PREVIEW_MARKER: &str = "__pyweavePreview";
const PREVIEW_SEQUENCE: &str = "sequence";
const PREVIEW_MAPPING: &str = "mapping";

#[derive(Clone, Debug)]
pub struct ValueConversionLimits {
    preview_items: Option<usize>,
}

impl ValueConversionLimits {
    pub fn from_environment() -> PyResult<Self> {
        Ok(Self {
            preview_items: preview_items_limit()?,
        })
    }
}

pub fn to_json_value_with_limits(
    value: &Bound<'_, PyAny>,
    limits: &ValueConversionLimits,
) -> PyResult<Value> {
    if value.is_none() {
        return Ok(Value::Null);
    }

    if value.is_instance_of::<PyBool>() {
        return value.extract::<bool>().map(Value::Bool);
    }

    if let Ok(integer) = value.extract::<i64>() {
        return Ok(number_value(integer));
    }

    if value.is_instance_of::<PyFloat>() {
        return value.extract::<f64>().and_then(float_value);
    }

    if value.is_instance_of::<PyString>() {
        return value.extract::<String>().map(Value::String);
    }

    if let Ok(list) = value.cast::<PyList>() {
        return sequence_value("list", list.len(), |index| list.get_item(index), limits);
    }

    if let Ok(tuple) = value.cast::<PyTuple>() {
        return sequence_value("tuple", tuple.len(), |index| tuple.get_item(index), limits);
    }

    if let Ok(dict) = value.cast::<PyDict>() {
        return mapping_value(dict, limits);
    }

    Err(PyTypeError::new_err(
        "unsupported Python local value for JSON timeline",
    ))
}

fn number_value(value: i64) -> Value {
    Value::Number(Number::from(value))
}

fn float_value(value: f64) -> PyResult<Value> {
    Number::from_f64(value)
        .map(Value::Number)
        .ok_or_else(|| PyValueError::new_err("cannot serialize non-finite Python float as JSON"))
}

fn sequence_value<'py>(
    type_name: &str,
    len: usize,
    get_item: impl Fn(usize) -> PyResult<Bound<'py, PyAny>>,
    limits: &ValueConversionLimits,
) -> PyResult<Value> {
    if let Some(preview_items) = preview_item_limit(limits, len) {
        return sequence_preview(type_name, len, get_item, limits, preview_items);
    }

    let values: PyResult<Vec<Value>> = (0..len)
        .map(|index| get_item(index).and_then(|item| to_json_value_with_limits(&item, limits)))
        .collect();
    values.map(Value::Array)
}

fn mapping_value(dict: &Bound<'_, PyDict>, limits: &ValueConversionLimits) -> PyResult<Value> {
    if let Some(preview_items) = preview_item_limit(limits, dict.len()) {
        return mapping_preview(dict, limits, preview_items);
    }

    let mut output = Map::new();

    for (key, item) in dict.iter() {
        output.insert(
            key.extract::<String>()?,
            to_json_value_with_limits(&item, limits)?,
        );
    }

    Ok(Value::Object(output))
}

fn sequence_preview<'py>(
    type_name: &str,
    len: usize,
    get_item: impl Fn(usize) -> PyResult<Bound<'py, PyAny>>,
    limits: &ValueConversionLimits,
    preview_items: usize,
) -> PyResult<Value> {
    let tail_count = preview_tail_count(preview_items);
    let head_count = preview_items.saturating_sub(tail_count);
    let tail_start = len.saturating_sub(tail_count);
    let mut output = preview_base(PREVIEW_SEQUENCE, type_name, len);

    output.insert(
        "head".to_owned(),
        Value::Array(convert_index_range(0, head_count, &get_item, limits)?),
    );
    output.insert("tailStart".to_owned(), usize_value(tail_start));
    output.insert(
        "tail".to_owned(),
        Value::Array(convert_index_range(tail_start, len, &get_item, limits)?),
    );

    Ok(Value::Object(output))
}

fn mapping_preview(
    dict: &Bound<'_, PyDict>,
    limits: &ValueConversionLimits,
    preview_items: usize,
) -> PyResult<Value> {
    let mut entries = Map::new();
    let mut output = preview_base(PREVIEW_MAPPING, "dict", dict.len());

    for (index, (key, item)) in dict.iter().enumerate() {
        if index >= preview_items {
            break;
        }

        entries.insert(
            key.extract::<String>()?,
            to_json_value_with_limits(&item, limits)?,
        );
    }

    output.insert("entries".to_owned(), Value::Object(entries));
    Ok(Value::Object(output))
}

fn convert_index_range<'py>(
    start: usize,
    end: usize,
    get_item: &impl Fn(usize) -> PyResult<Bound<'py, PyAny>>,
    limits: &ValueConversionLimits,
) -> PyResult<Vec<Value>> {
    (start..end)
        .map(|index| get_item(index).and_then(|item| to_json_value_with_limits(&item, limits)))
        .collect()
}

fn preview_base(kind: &str, type_name: &str, len: usize) -> Map<String, Value> {
    let mut output = Map::new();

    output.insert(PREVIEW_MARKER.to_owned(), Value::String(kind.to_owned()));
    output.insert("typeName".to_owned(), Value::String(type_name.to_owned()));
    output.insert("length".to_owned(), usize_value(len));
    output.insert("truncated".to_owned(), Value::Bool(true));

    output
}

fn preview_item_limit(limits: &ValueConversionLimits, len: usize) -> Option<usize> {
    limits
        .preview_items
        .filter(|preview_items| len > *preview_items)
}

fn preview_tail_count(preview_items: usize) -> usize {
    if preview_items < MIN_HEAD_AND_TAIL_PREVIEW_ITEMS {
        return 0;
    }

    std::cmp::max(MIN_TAIL_PREVIEW_ITEMS, preview_items / PREVIEW_TAIL_DIVISOR)
}

fn preview_items_limit() -> PyResult<Option<usize>> {
    let Ok(value) = env::var(VALUE_PREVIEW_ITEMS_ENV) else {
        return Ok(Some(DEFAULT_VALUE_PREVIEW_ITEMS));
    };
    let limit = value.parse::<usize>().map_err(|error| {
        PyRuntimeError::new_err(format!(
            "{VALUE_PREVIEW_ITEMS_ENV} must be an integer: {error}"
        ))
    })?;

    Ok((limit > 0).then_some(limit))
}

fn usize_value(value: usize) -> Value {
    Value::Number(Number::from(value as u64))
}
