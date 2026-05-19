extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var new_faction_id: String = "runtime-added-faction-ui-test"
	var new_faction_name: String = "运行态新增势力"
	var factions: Array = _array(game_state.get("factions")).duplicate(true)
	factions.append({
		"id": new_faction_id,
		"name": new_faction_name,
		"type": "起义军",
		"attitude": "敌对",
		"leader": "测试渠帅",
		"capital": "测试地",
		"strength": 3,
		"army": "2,000",
		"military_strength": 2000,
		"economy": 2,
		"cohesion": 50,
		"public_opinion": 45,
		"relations_text": "对大明关系 5 · 敌意 85"
	})
	game_state.set("factions", factions)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var browser_panel: Node = _find_node_with_script(main, "res://scripts/faction_browser_panel.gd")
	if browser_panel == null:
		_fail("Main scene does not expose the faction browser panel")
		return

	var buttons: Dictionary = _dict(browser_panel.get("faction_row_buttons"))
	var button: Button = buttons.get(new_faction_id, null) as Button
	if button == null:
		_fail("Runtime-added faction did not receive a faction list row")
		return

	button.emit_signal("pressed")
	await get_tree().process_frame
	var panel: Node = _find_node_with_script(main, "res://scripts/faction_detail_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the faction detail panel")
		return
	var current: Dictionary = _dict(panel.get("current_faction"))
	if str(current.get("id", "")) != new_faction_id or str(current.get("name", "")) != new_faction_name:
		_fail("Runtime-added faction row did not select the live faction detail")
		return

	print("[TianmingGodotTest] faction list runtime addition scene test passed")
	_finish(0)

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
	print("[TianmingGodotTest] faction list runtime addition scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction list runtime addition scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
