use std::collections::BTreeSet;
use std::env;

use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyIterator};

const ALGORITHM_FILE: &str = "<pyweave_algorithm>";
const SAFE_BUILTIN_NAMES: &[&str] = &[
    "abs",
    "all",
    "any",
    "bool",
    "dict",
    "enumerate",
    "float",
    "int",
    "len",
    "list",
    "max",
    "min",
    "pow",
    "range",
    "reversed",
    "round",
    "sorted",
    "str",
    "sum",
    "tuple",
    "zip",
];
const ALLOWED_NODE_KINDS: &[&str] = &[
    "Add",
    "And",
    "AnnAssign",
    "Assign",
    "AugAssign",
    "BinOp",
    "BoolOp",
    "Break",
    "Call",
    "Compare",
    "Constant",
    "Continue",
    "Dict",
    "Div",
    "Eq",
    "Expr",
    "FloorDiv",
    "For",
    "FunctionDef",
    "Gt",
    "GtE",
    "If",
    "In",
    "Is",
    "IsNot",
    "List",
    "Load",
    "Lt",
    "LtE",
    "Mod",
    "Module",
    "Mult",
    "Name",
    "Not",
    "NotEq",
    "NotIn",
    "Or",
    "Pass",
    "Pow",
    "Return",
    "Slice",
    "Store",
    "Sub",
    "Subscript",
    "Tuple",
    "UAdd",
    "USub",
    "UnaryOp",
    "While",
    "arg",
    "arguments",
];
pub const UNRESTRICTED_PYTHON_ENV: &str = "PYWEAVE_ALLOW_UNRESTRICTED_PYTHON";

pub fn validate_source(py: Python<'_>, source: &str) -> PyResult<()> {
    if unrestricted_python_enabled() {
        return Ok(());
    }

    let tree = py
        .import("ast")?
        .getattr("parse")?
        .call1((source, ALGORITHM_FILE, "exec"))?;
    let function_names = collect_function_names(py, &tree)?;
    validate_tree(py, &tree, &function_names)
}

pub fn create_algorithm_globals(py: Python<'_>) -> PyResult<Bound<'_, PyDict>> {
    let globals = PyDict::new(py);

    if unrestricted_python_enabled() {
        globals.set_item("__builtins__", py.import("builtins")?)?;
        return Ok(globals);
    }

    globals.set_item("__builtins__", safe_builtins(py)?)?;
    Ok(globals)
}

fn unrestricted_python_enabled() -> bool {
    env::var(UNRESTRICTED_PYTHON_ENV).is_ok_and(|value| value == "1")
}

fn safe_builtins(py: Python<'_>) -> PyResult<Bound<'_, PyDict>> {
    let builtins = py.import("builtins")?;
    let output = PyDict::new(py);

    for name in SAFE_BUILTIN_NAMES {
        output.set_item(*name, builtins.getattr(*name)?)?;
    }

    Ok(output)
}

fn collect_function_names(py: Python<'_>, tree: &Bound<'_, PyAny>) -> PyResult<BTreeSet<String>> {
    let mut names = BTreeSet::new();

    for node in ast_nodes(py, tree)? {
        let node = node?;
        if node_kind(&node)? == "FunctionDef" {
            names.insert(node.getattr("name")?.extract()?);
        }
    }

    Ok(names)
}

fn validate_tree(
    py: Python<'_>,
    tree: &Bound<'_, PyAny>,
    function_names: &BTreeSet<String>,
) -> PyResult<()> {
    let allowed_nodes = allowed_node_kinds();

    for node in ast_nodes(py, tree)? {
        validate_node(&node?, function_names, &allowed_nodes)?;
    }

    Ok(())
}

fn validate_node(
    node: &Bound<'_, PyAny>,
    function_names: &BTreeSet<String>,
    allowed_nodes: &BTreeSet<&'static str>,
) -> PyResult<()> {
    let kind = node_kind(node)?;

    if !allowed_nodes.contains(kind.as_str()) {
        return policy_error(
            node,
            format!("{kind} is not available in the PyWeave subset"),
        );
    }

    match kind.as_str() {
        "Call" => validate_call(node, function_names),
        "FunctionDef" => validate_identifier(node, "name"),
        "Name" => validate_identifier(node, "id"),
        "arg" => validate_identifier(node, "arg"),
        _ => Ok(()),
    }
}

fn validate_call(node: &Bound<'_, PyAny>, function_names: &BTreeSet<String>) -> PyResult<()> {
    let func = node.getattr("func")?;

    if node_kind(&func)? != "Name" {
        return policy_error(node, "only direct calls to allowed functions are supported");
    }

    let name: String = func.getattr("id")?.extract()?;
    if SAFE_BUILTIN_NAMES.contains(&name.as_str()) || function_names.contains(&name) {
        return Ok(());
    }

    policy_error(node, format!("{name} is not an allowed function"))
}

fn validate_identifier(node: &Bound<'_, PyAny>, attribute: &str) -> PyResult<()> {
    let name: String = node.getattr(attribute)?.extract()?;

    if name.starts_with("__") {
        return policy_error(node, "dunder names are not available in the PyWeave subset");
    }

    Ok(())
}

fn ast_nodes<'py>(py: Python<'py>, tree: &Bound<'py, PyAny>) -> PyResult<Bound<'py, PyIterator>> {
    py.import("ast")?
        .getattr("walk")?
        .call1((tree,))?
        .try_iter()
}

fn node_kind(node: &Bound<'_, PyAny>) -> PyResult<String> {
    node.get_type().name().map(|name| name.to_string())
}

fn allowed_node_kinds() -> BTreeSet<&'static str> {
    ALLOWED_NODE_KINDS.iter().copied().collect()
}

fn policy_error<T>(node: &Bound<'_, PyAny>, message: impl AsRef<str>) -> PyResult<T> {
    let line = node
        .getattr("lineno")
        .ok()
        .and_then(|value| value.extract::<usize>().ok())
        .unwrap_or(1);
    Err(PyValueError::new_err(format!(
        "PyWeave policy rejected line {line}: {}. Set {UNRESTRICTED_PYTHON_ENV}=1 to run unrestricted local Python.",
        message.as_ref()
    )))
}
