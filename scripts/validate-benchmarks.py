#!/usr/bin/env python3
"""Validate the offline PPDC benchmark fixtures and their source references."""
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "benchmarks" / "schemas" / "deal-benchmark-case.schema.json"
REGISTRY = ROOT / "benchmarks" / "source-registry.json"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    schema = load(SCHEMA)
    validator = Draft202012Validator(schema)
    registry = load(REGISTRY)
    source_ids = {source["source_id"] for source in registry["sources"]}
    files = sorted((ROOT / "benchmarks" / "cases").rglob("*.json"))
    case_ids = set()
    errors = []
    for path in files:
        case = load(path)
        case_id = case.get("id", path.stem)
        for error in validator.iter_errors(case):
            errors.append(f"{path.relative_to(ROOT)}: {error.message}")
        if case_id in case_ids:
            errors.append(f"duplicate case id: {case_id}")
        case_ids.add(case_id)
        for source_id in case.get("source_ids", []):
            if source_id not in source_ids:
                errors.append(f"{case_id}: unknown source id {source_id}")
    if len(files) != 32:
        errors.append(f"expected 32 machine-readable cases, found {len(files)}")
    if errors:
        print("Benchmark validation failed:")
        print("\n".join(errors))
        return 1
    print(f"Benchmark validation passed: {len(files)} cases; source references resolved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())