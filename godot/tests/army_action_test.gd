extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")

func _ready() -> void:
	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return

	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return

	var army: Dictionary = _army_with_arrears(_array(state.get("armies")))
	if army.is_empty():
		_fail("Fixture army with arrears is missing")
		return

	var army_id: String = str(army.get("id", ""))
	var action_points_before: int = int(state.get("action_points"))
	var money_before: float = float(state.get("guoku_money"))
	var arrears_before: int = int(_num(army.get("pay_arrears_months", 0)))
	var morale_before: int = int(_num(army.get("morale", 0)))
	var loyalty_before: int = int(_num(army.get("loyalty", 0)))
	var mutiny_before: int = int(_num(army.get("mutiny_risk", 0)))

	var result: Dictionary = state.call("issue_army_action", "pay_army_arrears", army_id)
	if not result.get("ok", false):
		_fail("Army action failed: %s" % str(result.get("error", "")))
		return

	var updated: Dictionary = _army_by_id(_array(state.get("armies")), army_id)
	if int(_num(updated.get("pay_arrears_months", 0))) >= arrears_before:
		_fail("Army action did not reduce arrears")
		return
	if int(_num(updated.get("morale", 0))) <= morale_before:
		_fail("Army action did not improve morale")
		return
	if int(_num(updated.get("loyalty", 0))) <= loyalty_before:
		_fail("Army action did not improve loyalty")
		return
	if int(_num(updated.get("mutiny_risk", 0))) >= mutiny_before:
		_fail("Army action did not reduce mutiny risk")
		return
	if float(state.get("guoku_money")) >= money_before:
		_fail("Army action did not spend treasury money")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Army action did not spend one action point")
		return
	if _array(state.get("army_action_history")).is_empty():
		_fail("Army action did not record history")
		return

	var restored: RefCounted = GameStateScript.new()
	restored.call("load_from_scenario_result", load_result)
	var restore_result: Dictionary = restored.call("restore_save_snapshot", state.call("create_save_snapshot"))
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	var restored_army: Dictionary = _army_by_id(_array(restored.get("armies")), army_id)
	if int(_num(restored_army.get("pay_arrears_months", 0))) != int(_num(updated.get("pay_arrears_months", 0))):
		_fail("Save/load did not preserve army action result")
		return
	if _array(restored.get("army_action_history")).is_empty():
		_fail("Save/load did not preserve army action history")
		return

	print("[TianmingGodotTest] army action scene test passed")
	_finish(0)

func _army_with_arrears(rows: Array) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")).is_empty():
			continue
		if _num(row.get("pay_arrears_months", 0)) > 0.0 and _num(row.get("mutiny_risk", 0)) > 0.0:
			return row
	return {}

func _army_by_id(rows: Array, army_id: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")) == army_id:
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
	print("[TianmingGodotTest] army action scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
