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
	var actions: Array = _array(state.call("region_governance_actions"))
	if not _has_action(actions, "appoint_governor") or not _has_action(actions, "appoint_commander"):
		_fail("Region governance does not expose regional appointment actions")
		return

	var region: Dictionary = _first_region(_array(state.get("map_regions")))
	if region.is_empty():
		_fail("No region found for assignment test")
		return
	var region_id: String = str(region.get("id", ""))
	var ap_before: int = int(state.get("action_points"))
	var governor_result: Dictionary = state.call("perform_region_governance", region_id, "appoint_governor")
	if not governor_result.get("ok", false):
		_fail("Governor appointment failed: %s" % str(governor_result.get("error", "")))
		return
	var governed: Dictionary = state.call("region_by_id", region_id)
	var governor_name: String = str(governed.get("governor", ""))
	if governor_name.is_empty() or str(governed.get("governor_id", "")).is_empty():
		_fail("Governor appointment did not write governor fields")
		return
	var governor_record: Dictionary = _dict(_array(state.get("region_governance_history")).back())
	if str(governor_record.get("assigned_person", "")) != governor_name:
		_fail("Governor appointment history did not record assigned person")
		return

	var commander_result: Dictionary = state.call("perform_region_governance", region_id, "appoint_commander")
	if not commander_result.get("ok", false):
		_fail("Commander appointment failed: %s" % str(commander_result.get("error", "")))
		return
	var commanded: Dictionary = state.call("region_by_id", region_id)
	if str(commanded.get("commander", "")).is_empty() or str(commanded.get("commander_id", "")).is_empty():
		_fail("Commander appointment did not write commander fields")
		return
	if int(state.get("action_points")) != ap_before - 2:
		_fail("Regional appointments did not spend action points")
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
	var restored_region: Dictionary = restored.call("region_by_id", region_id)
	if str(restored_region.get("governor", "")) != governor_name:
		_fail("Restored region lost governor assignment")
		return
	if not _has_kind(_array(restored.call("chronicle_entries")), "region_governance"):
		_fail("Regional assignments did not enter chronicle entries")
		return

	print("[TianmingGodotTest] region assignment scene test passed")
	_finish(0)

func _has_action(actions: Array, id: String) -> bool:
	for raw in actions:
		if str(_dict(raw).get("id", "")) == id:
			return true
	return false

func _first_region(regions: Array) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if not str(region.get("id", "")).is_empty():
			return region
	return {}

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
	print("[TianmingGodotTest] region assignment scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] region assignment scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
