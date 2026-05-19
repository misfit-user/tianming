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
	if not state.has_method("communication_items") or not state.has_method("process_communication"):
		_fail("GameState does not expose communication inbox APIs")
		return

	var inbox: Array = _array(state.call("communication_items"))
	if inbox.size() < 2:
		_fail("Initial communication inbox should contain memorials and correspondence")
		return
	if not _has_kind(inbox, "memorial") or not _has_kind(inbox, "letter"):
		_fail("Initial communication inbox should mix memorial and letter kinds")
		return

	var first_id: String = str(_dict(inbox[0]).get("id", ""))
	var pending_before: int = _array(state.get("pending_court_recommendations")).size()
	var result: Dictionary = state.call("process_communication", first_id, "recommend")
	if not result.get("ok", false):
		_fail("Processing communication failed: %s" % str(result.get("error", "")))
		return
	if _array(state.call("communication_items")).size() != inbox.size() - 1:
		_fail("Processed communication remained in inbox")
		return
	if _array(state.get("communication_archive")).size() != 1:
		_fail("Processed communication was not archived")
		return
	if _array(state.get("pending_court_recommendations")).size() != pending_before + 1:
		_fail("Communication recommend action did not create a court recommendation")
		return

	state.call("advance_month")
	if _array(state.call("communication_items")).is_empty():
		_fail("Monthly advance did not keep or generate communication items")
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
	if _array(restored.call("communication_items")).size() != _array(state.call("communication_items")).size():
		_fail("Restored communication inbox count changed")
		return
	if _array(restored.get("communication_archive")).size() != _array(state.get("communication_archive")).size():
		_fail("Restored communication archive count changed")
		return

	print("[TianmingGodotTest] communication state scene test passed")
	_finish(0)

func _has_kind(items: Array, kind: String) -> bool:
	for raw in items:
		if str(_dict(raw).get("kind", "")) == kind:
			return true
	return false

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] communication state scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] communication state scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
