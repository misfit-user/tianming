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
	if not state.has_method("perform_player_action"):
		_fail("GameState does not expose perform_player_action")
		return
	if _array(state.get("player_actions")).size() < 3:
		_fail("Player action list is not initialized")
		return
	if int(state.get("action_points")) != 3:
		_fail("Initial action points should be 3")
		return

	var guoku_before: float = float(state.get("guoku_money"))
	var neitang_before: float = float(state.get("neitang_money"))
	var liao_before: float = float(state.call("variable_value", "辽饷积欠"))
	var result: Dictionary = state.call("perform_player_action", "open_neitang_liaoxiang")
	if not result.get("ok", false):
		_fail("Open-neitang action failed: %s" % str(result.get("error", "")))
		return
	if int(state.get("action_points")) != 2:
		_fail("Action point was not spent")
		return
	if not is_equal_approx(float(state.get("guoku_money")), guoku_before + 500000.0):
		_fail("Open-neitang action did not move money into guoku")
		return
	if not is_equal_approx(float(state.get("neitang_money")), neitang_before - 500000.0):
		_fail("Open-neitang action did not spend neitang")
		return
	if not is_equal_approx(float(state.call("variable_value", "辽饷积欠")), liao_before - 50.0):
		_fail("Open-neitang action did not reduce Liaodong arrears")
		return

	state.set("action_points", 0)
	var blocked: Dictionary = state.call("perform_player_action", "relief_refugees")
	if blocked.get("ok", false):
		_fail("Action succeeded without action points")
		return

	state.call("advance_month")
	if int(state.get("action_points")) != 3:
		_fail("Action points did not reset on new month")
		return

	print("[TianmingGodotTest] court action scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court action scene test exit_code=%d" % exit_code)
