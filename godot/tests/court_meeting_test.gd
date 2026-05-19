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
	if not state.has_method("hold_court_meeting"):
		_fail("GameState does not expose hold_court_meeting")
		return
	if _array(state.get("court_meeting_topics")).is_empty():
		_fail("Court meeting topics were not initialized")
		return

	var participant_ids: Array = _prepare_strong_participants(state)
	if participant_ids.size() < 3:
		_fail("Not enough participants for court meeting")
		return

	var action_points_before: int = int(state.get("action_points"))
	var huangquan_before: float = float(state.get("huangquan"))
	var treasury_before: float = float(state.get("guoku_money"))
	var result: Dictionary = state.call("hold_court_meeting", "finance_council", participant_ids)
	if not result.get("ok", false):
		_fail("Court meeting failed: %s" % str(result.get("error", "")))
		return

	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Court meeting did not spend one action point")
		return
	if float(state.get("huangquan")) <= huangquan_before:
		_fail("Court meeting did not improve imperial authority")
		return
	if float(state.get("guoku_money")) <= treasury_before:
		_fail("Successful finance council did not improve treasury")
		return
	if float(result.get("score", 0)) < 70.0:
		_fail("Prepared participants did not produce a successful meeting score")
		return
	if _array(state.get("court_meeting_history")).is_empty():
		_fail("Court meeting history was not recorded")
		return

	print("[TianmingGodotTest] court meeting scene test passed")
	_finish(0)

func _prepare_strong_participants(state: RefCounted) -> Array:
	var rows: Array = _array(state.get("characters")).duplicate(true)
	var ids: Array = []
	for i in range(rows.size()):
		var character: Dictionary = _dict(rows[i]).duplicate(true)
		var id: String = str(character.get("id", ""))
		if id.is_empty():
			continue
		character["intelligence"] = 90
		character["administration"] = 92
		character["management"] = 88
		character["loyalty"] = 80
		rows[i] = character
		ids.append(id)
		if ids.size() >= 3:
			break
	state.set("characters", rows)
	return ids

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
