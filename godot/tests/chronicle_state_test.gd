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
	if not state.has_method("chronicle_entries"):
		_fail("GameState does not expose chronicle_entries")
		return

	var action_result: Dictionary = state.call("perform_player_action", "open_neitang_liaoxiang")
	if not action_result.get("ok", false):
		_fail("Preparing player action failed: %s" % str(action_result.get("error", "")))
		return
	state.call("advance_month")
	state.call("advance_month")

	var entries: Array = _array(state.call("chronicle_entries"))
	if _kind_count(entries, "monthly_report") < 2:
		_fail("Chronicle did not keep multiple monthly reports")
		return
	if not _has_month(entries, 9) or not _has_month(entries, 10):
		_fail("Chronicle did not preserve older report months")
		return
	if not _has_kind(entries, "player_action"):
		_fail("Chronicle did not include player action history")
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
	if _array(restored.call("chronicle_entries")).size() != entries.size():
		_fail("Restored chronicle entry count changed")
		return

	print("[TianmingGodotTest] chronicle state scene test passed")
	_finish(0)

func _kind_count(entries: Array, kind: String) -> int:
	var count: int = 0
	for raw in entries:
		var entry: Dictionary = _dict(raw)
		if str(entry.get("kind", "")) == kind:
			count += 1
	return count

func _has_kind(entries: Array, kind: String) -> bool:
	return _kind_count(entries, kind) > 0

func _has_month(entries: Array, month: int) -> bool:
	for raw in entries:
		var entry: Dictionary = _dict(raw)
		if str(entry.get("kind", "")) == "monthly_report" and int(_num(entry.get("month", 0))) == month:
			return true
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	print("[TianmingGodotTest] chronicle state scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] chronicle state scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
