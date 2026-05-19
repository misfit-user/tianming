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
	if not state.has_method("appoint_character"):
		_fail("GameState does not expose appoint_character")
		return
	if _array(state.get("characters")).is_empty():
		_fail("Runtime characters were not initialized")
		return
	if _array(state.get("court_offices")).size() < 4:
		_fail("Court offices were not initialized")
		return

	var candidate: Dictionary = state.call("character_by_name", "孙承宗")
	if candidate.is_empty():
		_fail("Sun Chengzong was not found")
		return
	var loyalty_before: float = float(candidate.get("loyalty", 0))
	var action_points_before: int = int(state.get("action_points"))
	var result: Dictionary = state.call("appoint_character", str(candidate.get("id", "")), "liaodong_dushi")
	if not result.get("ok", false):
		_fail("Appointment failed: %s" % str(result.get("error", "")))
		return
	var updated: Dictionary = state.call("character_by_name", "孙承宗")
	if str(updated.get("official_title", "")) != "辽东督师":
		_fail("Appointment did not update official title")
		return
	if float(updated.get("loyalty", 0)) < loyalty_before:
		_fail("Promotion reduced loyalty")
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Appointment did not spend one action point")
		return
	if str(state.call("office_holder_name", "liaodong_dushi")) != "孙承宗":
		_fail("Office holder was not updated")
		return
	if _array(state.get("appointment_history")).is_empty():
		_fail("Appointment history was not recorded")
		return

	print("[TianmingGodotTest] appointment scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] appointment scene test exit_code=%d" % exit_code)
