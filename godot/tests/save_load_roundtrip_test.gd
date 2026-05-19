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
	if not state.has_method("create_save_snapshot") or not state.has_method("restore_save_snapshot"):
		_fail("GameState does not expose save/load snapshot API")
		return

	var chahar_id: String = str(_faction_by_name(_array(state.get("factions")), "察哈尔").get("id", ""))
	if chahar_id.is_empty():
		_fail("Chahar faction was not found")
		return

	var action_result: Dictionary = state.call("perform_player_action", "open_neitang_liaoxiang")
	if not action_result.get("ok", false):
		_fail("Preparing court action failed: %s" % str(action_result.get("error", "")))
		return
	var diplomacy_result: Dictionary = state.call("issue_diplomacy_action", "support_chahar", chahar_id)
	if not diplomacy_result.get("ok", false):
		_fail("Preparing diplomacy action failed: %s" % str(diplomacy_result.get("error", "")))
		return
	state.call("advance_month")

	var snapshot: Dictionary = state.call("create_save_snapshot")
	if str(snapshot.get("format", "")) != "tianming-godot-save-v1":
		_fail("Save snapshot format marker is missing")
		return

	var restored: RefCounted = GameStateScript.new()
	var restored_init: Dictionary = restored.call("load_from_scenario_result", load_result)
	if not restored_init.get("ok", false):
		_fail("Restored state init failed: %s" % str(restored_init.get("error", "")))
		return
	var restore_result: Dictionary = restored.call("restore_save_snapshot", snapshot)
	if not restore_result.get("ok", false):
		_fail("Restore failed: %s" % str(restore_result.get("error", "")))
		return

	_assert_equal_int("turn", int(restored.get("turn")), int(state.get("turn")))
	_assert_equal_int("year", int(restored.get("year")), int(state.get("year")))
	_assert_equal_int("month", int(restored.get("month")), int(state.get("month")))
	_assert_equal_int("action_points", int(restored.get("action_points")), int(state.get("action_points")))
	_assert_equal_float("guoku_money", float(restored.get("guoku_money")), float(state.get("guoku_money")))
	_assert_equal_float("neitang_money", float(restored.get("neitang_money")), float(state.get("neitang_money")))
	_assert_equal_float("liao arrears", float(restored.call("variable_value", "辽饷积欠")), float(state.call("variable_value", "辽饷积欠")))
	_assert_equal_int("action history", _array(restored.get("action_history")).size(), _array(state.get("action_history")).size())
	_assert_equal_int("diplomacy history", _array(restored.get("diplomacy_history")).size(), _array(state.get("diplomacy_history")).size())
	_assert_equal_int("active commitments", _array(restored.get("active_diplomacy_commitments")).size(), _array(state.get("active_diplomacy_commitments")).size())
	if _failed:
		return

	var restored_commitment: Dictionary = _dict(_array(restored.get("active_diplomacy_commitments"))[0])
	if str(restored_commitment.get("id", "")) != "support_chahar" or int(restored_commitment.get("remaining_months", 0)) != 1:
		_fail("Restored diplomacy commitment did not preserve identity and remaining duration")
		return

	var next_original: Dictionary = state.call("advance_month")
	var next_restored: Dictionary = restored.call("advance_month")
	_assert_equal_int("post-restore turn", int(restored.get("turn")), int(state.get("turn")))
	_assert_equal_float("post-restore guoku_money", float(restored.get("guoku_money")), float(state.get("guoku_money")))
	_assert_equal_float("post-restore huangwei", float(restored.get("huangwei")), float(state.get("huangwei")))
	_assert_equal_int("post-restore events", _array(next_restored.get("events")).size(), _array(next_original.get("events")).size())
	if _failed:
		return

	print("[TianmingGodotTest] save/load roundtrip scene test passed")
	_finish(0)

var _failed: bool = false

func _assert_equal_int(label: String, actual: int, expected: int) -> void:
	if actual != expected:
		_failed = true
		_fail("%s mismatch: got %d expected %d" % [label, actual, expected])

func _assert_equal_float(label: String, actual: float, expected: float) -> void:
	if not is_equal_approx(actual, expected):
		_failed = true
		_fail("%s mismatch: got %.3f expected %.3f" % [label, actual, expected])

func _faction_by_name(factions: Array, faction_name: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("name", "")) == faction_name:
			return faction
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	if not _failed:
		_failed = true
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save/load roundtrip scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
