extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/faction_detail_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the faction detail panel")
		return
	if not panel.has_signal("faction_action_requested") or not panel.has_method("visible_text"):
		_fail("Faction detail panel does not expose transfer-capable UI APIs")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	var target: Dictionary = _dict(panel.get("current_faction"))
	if target.is_empty() or str(target.get("name", "")).contains("明"):
		target = _first_target_faction(_array(game_state.get("factions")))
		panel.call("set_faction", target)
	var target_id: String = str(target.get("id", ""))
	var target_name: String = str(target.get("name", target_id))
	var region_id: String = "transfer-ui-test-region"
	_append_transfer_region(game_state, region_id, target_id, target_name)

	panel.emit_signal("faction_action_requested", target_id, "assert_suzerainty")
	await get_tree().process_frame
	var updated_region: Dictionary = game_state.call("region_by_id", region_id)
	if str(updated_region.get("owner", "")) == target_name or not str(updated_region.get("owner", "")).contains("明"):
		_fail("Faction transfer UI did not route ownership transfer")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("归属测试地块") or not text.contains("归属"):
		_fail("Faction transfer UI did not display ownership transfer history")
		return

	print("[TianmingGodotTest] faction region transfer UI scene test passed")
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

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] faction region transfer UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction region transfer UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
