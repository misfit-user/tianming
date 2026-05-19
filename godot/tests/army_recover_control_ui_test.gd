extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/army_roster_panel.gd")
	if panel == null:
		_fail("Main scene does not expose army roster panel")
		return
	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var setup: Dictionary = _force_enemy_control_fixture(game_state)
	if not setup.get("ok", false):
		_fail(str(setup.get("error", "fixture setup failed")))
		return
	var army_id: String = str(setup.get("army_id", ""))
	var region_id: String = str(setup.get("region_id", ""))
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	panel.emit_signal("army_action_requested", army_id, "recover_garrison_control")
	await get_tree().process_frame

	var updated_region: Dictionary = game_state.call("region_by_id", region_id)
	if str(updated_region.get("controller_id", "")) != "ming":
		_fail("Army recover-control UI request did not restore region controller")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("收复驻地"):
		_fail("Army recover-control UI history did not show action name")
		return
	if not text.contains(str(updated_region.get("name", ""))):
		_fail("Army recover-control UI history did not show target region")
		return
	if not text.contains("测试叛军") or not text.contains("大明"):
		_fail("Army recover-control UI history did not show controller transfer")
		return

	print("[TianmingGodotTest] army recover control UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _force_enemy_control_fixture(state: RefCounted) -> Dictionary:
	var armies: Array = _array(state.get("armies")).duplicate(true)
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	if armies.is_empty() or regions.is_empty():
		return {"ok": false, "error": "not enough armies or regions"}
	var army: Dictionary = _dict(armies[0]).duplicate(true)
	var region: Dictionary = _dict(regions[0]).duplicate(true)
	var region_id: String = str(region.get("id", "recover-control-ui-region"))
	var region_name: String = str(region.get("name", "Recover Control UI Region"))
	army["garrison"] = region_name
	army["location"] = region_name
	army["region_id"] = region_id
	region["id"] = region_id
	region["name"] = region_name
	region["owner_id"] = "ming"
	region["owner"] = "大明"
	region["controller_id"] = "uprising-ui-test"
	region["controller"] = "测试叛军"
	region["unrest"] = 90
	region["army_pressure"] = 82
	region["mood"] = 12
	armies[0] = army
	regions[0] = region
	state.set("armies", armies)
	state.set("map_regions", regions)
	return {
		"ok": true,
		"army_id": str(army.get("id", "")),
		"region_id": region_id
	}

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
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army recover control UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
