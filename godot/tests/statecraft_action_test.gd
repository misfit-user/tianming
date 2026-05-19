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
	if not state.has_method("statecraft_actions") or not state.has_method("perform_statecraft_action"):
		_fail("GameState does not expose statecraft action APIs")
		return

	var target_name: String = "言路通塞"
	if not _dict(state.get("variable_values")).has(target_name):
		_fail("Target variable was not loaded: %s" % target_name)
		return
	var actions: Array = _array(state.call("statecraft_actions"))
	if actions.size() < 3:
		_fail("Statecraft actions were not initialized")
		return

	state.call("set_variable_value", target_name, 40.0)
	var value_before: float = float(state.call("variable_value", target_name))
	var treasury_before: float = float(state.get("guoku_money"))
	var ap_before: int = int(state.get("action_points"))
	var result: Dictionary = state.call("perform_statecraft_action", target_name, "open_remonstrance")
	if not result.get("ok", false):
		_fail("Statecraft action failed: %s" % str(result.get("error", "")))
		return

	var value_after: float = float(state.call("variable_value", target_name))
	if value_after <= value_before:
		_fail("Statecraft action did not improve the target variable")
		return
	if float(state.get("guoku_money")) >= treasury_before:
		_fail("Statecraft action did not spend treasury money")
		return
	if int(state.get("action_points")) != ap_before - 1:
		_fail("Statecraft action did not spend one action point")
		return
	if _array(state.get("statecraft_history")).size() != 1:
		_fail("Statecraft action history was not recorded")
		return

	var snapshot: Dictionary = state.call("create_save_snapshot")
	var restored: RefCounted = GameStateScript.new()
	var restored_init: Dictionary = restored.call("load_from_scenario_result", load_result)
	if not restored_init.get("ok", false):
		_fail("Restored state init failed: %s" % str(restored_init.get("error", "")))
		return
	var restore_result: Dictionary = restored.call("restore_save_snapshot", snapshot)
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return
	if _array(restored.get("statecraft_history")).size() != 1:
		_fail("Restored statecraft history count changed")
		return
	if not is_equal_approx(float(restored.call("variable_value", target_name)), value_after):
		_fail("Restored target variable value changed")
		return
	if not _has_kind(_array(restored.call("chronicle_entries")), "statecraft"):
		_fail("Statecraft history did not enter chronicle entries")
		return

	print("[TianmingGodotTest] statecraft action scene test passed")
	_finish(0)

func _has_kind(entries: Array, kind: String) -> bool:
	for raw in entries:
		if str(_dict(raw).get("kind", "")) == kind:
			return true
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] statecraft action scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] statecraft action scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
