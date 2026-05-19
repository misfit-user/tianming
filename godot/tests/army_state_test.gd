extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")

func _ready() -> void:
	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return

	var summary: Dictionary = _dict(load_result.get("summary", {}))
	var army_rows: Array = _array(summary.get("army_rows", []))
	if army_rows.size() < 20:
		_fail("Scenario loader did not expose the official army roster")
		return
	if _army_by_name(army_rows, "关宁军主力").is_empty():
		_fail("Scenario loader omitted Guanning main army")
		return

	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return

	var armies: Array = _array(state.get("armies"))
	if armies.size() != army_rows.size():
		_fail("GameState did not copy army rows into runtime state")
		return
	var guanning: Dictionary = _army_by_name(armies, "关宁军主力")
	if str(guanning.get("commander", "")) != "阎鸣泰":
		_fail("Runtime Guanning army did not preserve commander")
		return
	if int(_num(guanning.get("soldiers", 0))) < 70000:
		_fail("Runtime Guanning army did not preserve soldier count")
		return
	if not str(guanning.get("equipment_text", "")).contains("红衣大炮"):
		_fail("Runtime Guanning army did not preserve equipment detail")
		return

	var snapshot: Dictionary = state.call("create_save_snapshot")
	var restored: RefCounted = GameStateScript.new()
	restored.call("load_from_scenario_result", load_result)
	var restore_result: Dictionary = restored.call("restore_save_snapshot", snapshot)
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	if _array(restored.get("armies")).size() != armies.size():
		_fail("Save/load did not preserve runtime army roster")
		return

	print("[TianmingGodotTest] army state scene test passed")
	_finish(0)

func _army_by_name(rows: Array, army_name: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("name", "")) == army_name:
			return row
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army state scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
