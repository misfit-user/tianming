extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const ArmyRosterPanelScript := preload("res://scripts/army_roster_panel.gd")

func _ready() -> void:
	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return

	var panel: Control = ArmyRosterPanelScript.new()
	add_child(panel)
	panel.call("set_data", _array(state.get("armies")))
	await get_tree().process_frame

	var text: String = str(panel.call("visible_text"))
	for expected in ["关宁军主力", "阎鸣泰", "红衣大炮", "兵员", "欠饷", "哗变"]:
		if not text.contains(expected):
			_fail("Army roster panel omitted expected text: %s" % expected)
			return

	print("[TianmingGodotTest] army roster panel scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army roster panel scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
