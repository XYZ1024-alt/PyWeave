use pyo3::exceptions::{PyTypeError, PyValueError};
use pyo3::prelude::*;
use pyo3::types::{PyBool, PyDict, PyFloat, PyList, PyString, PyTuple};
use serde_json::{Map, Number, Value};

pub fn to_json_value(value: &Bound<'_, PyAny>) -> PyResult<Value> {
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
        return sequence_value(list.iter());
    }

    if let Ok(tuple) = value.cast::<PyTuple>() {
        return sequence_value(tuple.iter());
    }

    if let Ok(dict) = value.cast::<PyDict>() {
        return mapping_value(dict);
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

fn sequence_value<'py>(items: impl Iterator<Item = Bound<'py, PyAny>>) -> PyResult<Value> {
    items.map(|item| to_json_value(&item)).collect()
}

fn mapping_value(dict: &Bound<'_, PyDict>) -> PyResult<Value> {
    let mut output = Map::new();

    for (key, item) in dict.iter() {
        output.insert(key.extract::<String>()?, to_json_value(&item)?);
    }

    Ok(Value::Object(output))
}
