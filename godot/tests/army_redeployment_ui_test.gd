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

	var setup: Dictionary = _force_fixture_locations(game_state)
	if not setup.get("ok", false):
		_fail(str(setup.get("error", "fixture setup failed")))
		return
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var army_id: String = str(setup.get("army_id", ""))
	var target_id: String = str(setup.get("target_id", ""))
	var target_name: String = str(setup.get("target_name", ""))
	panel.emit_signal("army_redeploy_requested", army_id, target_id)
	await get_tree().process_frame

	var updated_army: Dictionary = _army_by_id(_array(game_state.get("armies")), army_id)
	if str(updated_army.get("garrison", "")) != target_name:
		_fail("Army redeployment UI request did not update runtime army location")
		return
	var history: Array = _array(game_state.get("army_redeployment_history"))
	if history.is_empty():
		_fail("Army redeployment UI request did not record history")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains(target_name) or not text.contains(str(_dict(history[history.size() - 1]).get("name", ""))):
		_fail("Army roster panel did not refresh redeployment history after request")
		return

	print("[TianmingGodotTest] army redeployment UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _force_fixture_locations(state: RefCounted) -> Dictionary:
	var armies: Array = _array(state.get("armies")).duplicate(true)
	var regions: Array = _array(state.get("map_regions")).duplicate(true)
	if armies.is_empty() or regions.size() < 2:
		return {"ok": false, "error": "not enough armies or regions"}
	var army: Dictionary = _dict(armies[0]).duplicate(true)
	var source: Dictionary = _dict(regions[0]).duplicate(true)
	var target: Dictionary = _dict(regions[1]).duplicate(true)
	army["garrison"] = str(source.get("name", ""))
	army["location"] = str(source.get("name", ""))
	army["soldiers"] = 5000
	army["soldiers_text"] = "5000人"
	source["troops"] = 10000
	target["troops"] = 2000
	armies[0] = army
	regions[0] = source
	regions[1] = target
	state.set("armies", armies)
	state.set("map_regions", regions)
	return {
		"ok": true,
		"army_id": str(army.get("id", "")),
		"target_id": str(target.get("id", "")),
		"target_name": str(target.get("name", ""))
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

func _army_by_id(rows: Array, army_id: String) -> Dictionary:
	for raw in rows:
		var row: Dictionary = _dict(raw)
		if str(row.get("id", "")) == army_id:
			return row
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] army redeployment UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
