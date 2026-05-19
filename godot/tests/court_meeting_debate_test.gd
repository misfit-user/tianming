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

	var participant_ids: Array = _prepare_mixed_participants(state)
	if participant_ids.size() < 4:
		_fail("Not enough participants for debate meeting")
		return

	var meeting_result: Dictionary = state.call("hold_court_meeting", "finance_council", participant_ids)
	if not meeting_result.get("ok", false):
		_fail("Court meeting failed: %s" % str(meeting_result.get("error", "")))
		return

	var record: Dictionary = _dict(meeting_result.get("record", {}))
	var debate_entries: Array = _array(record.get("debate_entries", []))
	if debate_entries.size() < 4:
		_fail("Court meeting did not record participant debate entries")
		return
	if not _has_stance(debate_entries, "support"):
		_fail("Court meeting debate did not include a supporting voice")
		return
	if not (_has_stance(debate_entries, "oppose") or _has_stance(debate_entries, "caution")):
		_fail("Court meeting debate did not include a dissenting or cautious voice")
		return
	if str(_dict(debate_entries[0]).get("speech", "")).is_empty():
		_fail("Court meeting debate entries did not include speech text")
		return

	var pending: Array = _array(state.get("pending_court_recommendations"))
	var conflicting: Array = _recommendations_in_group(pending, "finance_followup")
	if conflicting.size() < 2:
		_fail("Finance meeting did not create conflicting follow-up recommendations")
		return

	var chosen: Dictionary = _find_recommendation(conflicting, "collect_arrears")
	if chosen.is_empty():
		chosen = _dict(conflicting[0])
	var chosen_id: String = str(chosen.get("id", ""))
	var enact_result: Dictionary = state.call("enact_court_recommendation", chosen_id)
	if not enact_result.get("ok", false):
		_fail("Enacting conflicting recommendation failed: %s" % str(enact_result.get("error", "")))
		return

	var pending_after: Array = _array(state.get("pending_court_recommendations"))
	for raw in pending_after:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("exclusive_group", "")) == "finance_followup":
			_fail("Enacting one finance recommendation left a conflicting finance recommendation pending")
			return

	if _array(state.get("discarded_court_recommendations")).is_empty():
		_fail("Discarded conflicting recommendations were not recorded")
		return

	if _followups_from(pending_after, chosen_id).is_empty():
		_fail("Enacted recommendation did not create a multi-step follow-up recommendation")
		return

	print("[TianmingGodotTest] court meeting debate scene test passed")
	_finish(0)

func _prepare_mixed_participants(state: RefCounted) -> Array:
	var rows: Array = _array(state.get("characters")).duplicate(true)
	var ids: Array = []
	for i in range(rows.size()):
		var character: Dictionary = _dict(rows[i]).duplicate(true)
		var id: String = str(character.get("id", ""))
		if id.is_empty():
			continue
		character["intelligence"] = 92
		character["administration"] = 94
		character["management"] = 90
		character["military"] = 70
		character["valor"] = 68
		character["party"] = ["qingliu", "neutral", "yandang", "bureaucrat"][ids.size()]
		character["faction"] = ["court", "court", "inner_court", "court"][ids.size()]
		character["loyalty"] = [86, 58, 42, 78][ids.size()]
		character["ambition"] = [20, 68, 92, 35][ids.size()]
		character.erase("relationships")
		character.erase("relations")
		character.erase("relationship")
		rows[i] = character
		ids.append(id)
		if ids.size() >= 4:
			break
	state.set("characters", rows)
	state.set("character_relations", [])
	return ids

func _has_stance(entries: Array, stance: String) -> bool:
	for raw in entries:
		var entry: Dictionary = _dict(raw)
		if str(entry.get("stance", "")) == stance:
			return true
	return false

func _recommendations_in_group(rows: Array, group: String) -> Array:
	var found: Array = []
	for raw in rows:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("exclusive_group", "")) == group:
			found.append(recommendation)
	return found

func _find_recommendation(rows: Array, decision_key: String) -> Dictionary:
	for raw in rows:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("decision_key", "")) == decision_key:
			return recommendation
	return {}

func _followups_from(rows: Array, source_id: String) -> Array:
	var found: Array = []
	for raw in rows:
		var recommendation: Dictionary = _dict(raw)
		if str(recommendation.get("source_recommendation_id", "")) == source_id:
			found.append(recommendation)
	return found

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting debate scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
