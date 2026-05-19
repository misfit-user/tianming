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
	if not state.has_method("enact_court_recommendation"):
		_fail("GameState does not expose enact_court_recommendation")
		return

	var participant_ids: Array = _prepare_strong_participants(state)
	var meeting_result: Dictionary = state.call("hold_court_meeting", "finance_council", participant_ids)
	if not meeting_result.get("ok", false):
		_fail("Court meeting failed: %s" % str(meeting_result.get("error", "")))
		return

	var pending: Array = _array(state.get("pending_court_recommendations"))
	if pending.is_empty():
		_fail("Successful court meeting did not create pending recommendations")
		return
	var recommendation: Dictionary = _dict(pending[0])
	var recommendation_id: String = str(recommendation.get("id", ""))
	if recommendation_id.is_empty():
		_fail("Pending recommendation has no id")
		return

	var action_points_before: int = int(state.get("action_points"))
	var treasury_before: float = float(state.get("guoku_money"))
	var enact_result: Dictionary = state.call("enact_court_recommendation", recommendation_id)
	if not enact_result.get("ok", false):
		_fail("Court recommendation enact failed: %s" % str(enact_result.get("error", "")))
		return
	if int(state.get("action_points")) != action_points_before - 1:
		_fail("Court recommendation did not spend one action point")
		return
	if float(state.get("guoku_money")) <= treasury_before:
		_fail("Finance recommendation did not improve treasury")
		return
	if _pending_has_id(_array(state.get("pending_court_recommendations")), recommendation_id):
		_fail("Enacted recommendation remained pending")
		return
	if _array(state.get("enacted_court_recommendations")).is_empty():
		_fail("Enacted recommendation history was not recorded")
		return

	print("[TianmingGodotTest] court meeting recommendation scene test passed")
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

func _pending_has_id(rows: Array, id: String) -> bool:
	for raw in rows:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("id", "")) == id:
			return true
	return false

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting recommendation scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
