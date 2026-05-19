extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const CourtActionPanelScript := preload("res://scripts/court_action_panel.gd")

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
	var result: Dictionary = state.call("perform_player_action", "open_neitang_liaoxiang")
	if not result.get("ok", false):
		_fail("Court action failed: %s" % str(result.get("error", "")))
		return

	var panel: Control = CourtActionPanelScript.new()
	add_child(panel)
	await get_tree().process_frame
	panel.call("set_actions", _array(state.get("player_actions")), int(_num(state.get("action_points"))), _array(state.get("action_history")))
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	if not text.contains("开内帑济辽饷"):
		_fail("Court action history omitted action name")
		return
	if not text.contains("耗行动点 1"):
		_fail("Court action history omitted action cost")
		return
	if not text.contains("国库银") or not text.contains("内帑") or not text.contains("辽饷积欠"):
		_fail("Court action history omitted applied effect details")
		return

	print("[TianmingGodotTest] court action history detail scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _num(value: Variant) -> float:
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		return float(value)
	return str(value).to_float()

func _fail(message: String) -> void:
	print("[TianmingGodotTest] court action history detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court action history detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
