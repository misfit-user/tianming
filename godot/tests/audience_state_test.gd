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
	if not state.has_method("audience_topics") or not state.has_method("hold_audience"):
		_fail("GameState does not expose audience APIs")
		return

	var topics: Array = _array(state.call("audience_topics"))
	if topics.size() < 3:
		_fail("Audience topics were not initialized")
		return
	var characters: Array = _array(state.get("characters"))
	if characters.is_empty():
		_fail("Characters were not loaded")
		return
	var character_id: String = str(_dict(characters[0]).get("id", ""))
	var topic_id: String = str(_dict(topics[0]).get("id", ""))
	var ap_before: int = int(state.get("action_points"))
	var result: Dictionary = state.call("hold_audience", character_id, topic_id)
	if not result.get("ok", false):
		_fail("Audience failed: %s" % str(result.get("error", "")))
		return
	if int(state.get("action_points")) != ap_before - 1:
		_fail("Audience did not consume one action point")
		return
	if _array(state.get("audience_history")).size() != 1:
		_fail("Audience history was not recorded")
		return
	var record: Dictionary = _dict(_array(state.get("audience_history"))[0])
	if str(record.get("response", "")).strip_edges().is_empty() or str(record.get("character_name", "")).strip_edges().is_empty():
		_fail("Audience record does not contain a response and character name")
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
	if _array(restored.get("audience_history")).size() != 1:
		_fail("Restored audience history count changed")
		return

	var chronicle: Array = _array(restored.call("chronicle_entries"))
	if not _has_kind(chronicle, "audience"):
		_fail("Audience history did not enter chronicle entries")
		return

	print("[TianmingGodotTest] audience state scene test passed")
	_finish(0)

func _has_kind(entries: Array, kind: String) -> bool:
	for raw in entries:
		if str(_dict(raw).get("kind", "")) == kind:
			return true
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] audience state scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] audience state scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
