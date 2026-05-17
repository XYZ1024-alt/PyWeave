mod python_runner;
mod python_value;
mod tracer;

use python_runner::run_sort_trace;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    pyo3::Python::initialize();

    let timeline = run_sort_trace()?;
    let json = serde_json::to_string_pretty(&timeline)?;
    println!("{json}");

    Ok(())
}
