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
	var actions: Array = _array(state.call("faction_actions"))
	if not _has_action(actions, "assert_suzerainty"):
		_fail("Faction actions do not expose region ownership transfer")
		return

	var target: Dictionary = _first_target_faction(_array(state.get("factions")))
	if target.is_empty():
		_fail("No target faction found for region transfer")
		return
	var target_id: String = str(target.get("id", ""))
	var target_name: String = str(target.get("name", target_id))
	var region_id: String = "transfer-test-region"
	_append_transfer_region(state, region_id, target_id, target_name)

	var ap_before: int = int(state.get("action_points"))
	var result: Dictionary = state.call("perform_faction_action", target_id, "assert_suzerainty")
	if not result.get("ok", false):
		_fail("Faction region transfer failed: %s" % str(result.get("error", "")))
		return

	var updated_region: Dictionary = state.call("region_by_id", region_id)
	if str(updated_region.get("owner", "")).is_empty() or str(updated_region.get("owner", "")) == target_name:
		_fail("Region owner did not transfer away from target faction")
		return
	if not str(updated_region.get("owner", "")).contains("明"):
		_fail("Region owner did not transfer to Ming")
		return
	if str(updated_region.get("controller", "")) != str(updated_region.get("owner", "")):
		_fail("Region controller did not follow transferred owner")
		return
	if int(state.get("action_points")) != ap_before - 1:
		_fail("Region transfer action did not spend one action point")
		return

	var history: Array = _array(state.get("faction_action_history"))
	if history.size() != 1:
		_fail("Faction region transfer history was not recorded")
		return
	var record: Dictionary = _dict(history[0])
	if _dict(record.get("region_transfer", {})).is_empty():
		_fail("Faction action history did not include region transfer details")
		return
	if not str(record.get("description", "")).contains("归属"):
		_fail("Faction action description did not mention ownership transfer")
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
	if str(restored_region.get("owner", "")) != str(updated_region.get("owner", "")):
		_fail("Restored state lost transferred region owner")
		return
	if not _has_kind(_array(restored.call("chronicle_entries")), "faction_action"):
		_fail("Faction region transfer did not enter chronicle entries")
		return

	print("[TianmingGodotTest] faction region transfer scene test passed")
	_finish(0)

func _append_transfer_region(state: RefCounted, region_id: String, target_id: String, target_name: String) -> void:
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	regions.append({
		"id": region_id,
		"name": "归属测试地块",
		"owner_id": target_id,
		"owner": target_name,
		"controller_id": target_id,
		"controller": target_name,
		"terrain": "山地",
		"resources": [],
		"development": 35,
		"prosperity": 42,
		"troops": 3000,
		"mood": 5,
		"unrest": 95,
		"tax_pressure": 22,
		"army_pressure": 95,
		"neighbors": [],
		"prefectures": [],
		"prefecture_count": 0
	})
	state.set("map_regions", regions)

func _first_target_faction(factions: Array) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("id", "")).is_empty():
			continue
		if str(faction.get("name", "")).contains("明"):
			continue
		return faction
	return {}

func _has_action(actions: Array, id: String) -> bool:
	for raw in actions:
		if str(_dict(raw).get("id", "")) == id:
			return true
	return false

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
	print("[TianmingGodotTest] faction region transfer scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction region transfer scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
