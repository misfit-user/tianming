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
	if not state.has_method("region_governance_actions") or not state.has_method("perform_region_governance") or not state.has_method("region_by_id"):
		_fail("GameState does not expose region governance APIs")
		return

	var actions: Array = _array(state.call("region_governance_actions"))
	if actions.size() < 3:
		_fail("Region governance actions were not initialized")
		return
	var region: Dictionary = _first_relief_region(_array(state.get("map_regions")))
	if region.is_empty():
		_fail("No relief-testable region was found")
		return
	var region_id: String = str(region.get("id", ""))
	var mood_before: float = float(region.get("mood", 0))
	var unrest_before: float = float(region.get("unrest", 0))
	var treasury_before: float = float(state.get("guoku_money"))
	var ap_before: int = int(state.get("action_points"))
	var result: Dictionary = state.call("perform_region_governance", region_id, "relief")
	if not result.get("ok", false):
		_fail("Region governance failed: %s" % str(result.get("error", "")))
		return
	var updated: Dictionary = state.call("region_by_id", region_id)
	if float(updated.get("mood", 0)) <= mood_before:
		_fail("Relief did not raise region mood")
		return
	if float(updated.get("unrest", 0)) >= unrest_before:
		_fail("Relief did not lower region unrest")
		return
	if float(state.get("guoku_money")) >= treasury_before:
		_fail("Relief did not spend treasury money")
		return
	if int(state.get("action_points")) != ap_before - 1:
		_fail("Region governance did not spend one action point")
		return
	if _array(state.get("region_governance_history")).size() != 1:
		_fail("Region governance history was not recorded")
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
	if _array(restored.get("region_governance_history")).size() != 1:
		_fail("Restored region governance history count changed")
		return
	if not _has_kind(_array(restored.call("chronicle_entries")), "region_governance"):
		_fail("Region governance history did not enter chronicle entries")
		return

	print("[TianmingGodotTest] region governance scene test passed")
	_finish(0)

func _first_relief_region(regions: Array) -> Dictionary:
	for raw in regions:
		var region: Dictionary = _dict(raw)
		if str(region.get("id", "")).is_empty():
			continue
		if float(region.get("mood", 0)) <= 94.0 and float(region.get("unrest", 0)) >= 6.0:
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
	print("[TianmingGodotTest] region governance scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] region governance scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
