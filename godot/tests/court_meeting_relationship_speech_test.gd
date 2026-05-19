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

	var participant_ids: Array = _prepare_relationship_participants(state)
	if participant_ids.size() < 3:
		_fail("Not enough participants for relationship speech test")
		return

	var meeting_result: Dictionary = state.call("hold_court_meeting", "finance_council", participant_ids)
	if not meeting_result.get("ok", false):
		_fail("Court meeting failed: %s" % str(meeting_result.get("error", "")))
		return

	var record: Dictionary = _dict(meeting_result.get("record", {}))
	var entries: Array = _array(record.get("debate_entries", []))
	var rival_entry: Dictionary = _entry_by_id(entries, str(participant_ids[1]))
	if rival_entry.is_empty():
		_fail("Relationship rival did not speak in the meeting")
		return
	if str(rival_entry.get("stance", "")) != "oppose":
		_fail("Negative relationship did not push a loyal participant into opposition")
		return
	var context: Dictionary = _dict(rival_entry.get("relationship_context", {}))
	if str(context.get("kind", "")) != "rival":
		_fail("Debate entry did not record rival relationship context")
		return
	if str(context.get("target_id", "")) != str(participant_ids[0]):
		_fail("Relationship context did not point at the rival target")
		return
	if not str(rival_entry.get("speech", "")).contains(str(context.get("target_name", ""))):
		_fail("Relationship-driven speech did not name the rival target")
		return

	print("[TianmingGodotTest] court meeting relationship speech scene test passed")
	_finish(0)

func _prepare_relationship_participants(state: RefCounted) -> Array:
	var rows: Array = _array(state.get("characters")).duplicate(true)
	var ids: Array = []
	for i in range(rows.size()):
		var character: Dictionary = _dict(rows[i]).duplicate(true)
		var id: String = str(character.get("id", ""))
		if id.is_empty():
			continue
		character["intelligence"] = 92
		character["administration"] = 92
		character["management"] = 90
		character["loyalty"] = 84
		character["ambition"] = 20
		rows[i] = character
		ids.append(id)
		if ids.size() >= 3:
			break
	if ids.size() >= 2:
		var rival: Dictionary = _dict(rows[1]).duplicate(true)
		rival["relationships"] = {
			str(ids[0]): -85
		}
		rows[1] = rival
	state.set("characters", rows)
	return ids

func _entry_by_id(entries: Array, character_id: String) -> Dictionary:
	for raw in entries:
		var entry: Dictionary = _dict(raw)
		if str(entry.get("character_id", "")) == character_id:
			return entry
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting relationship speech scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
