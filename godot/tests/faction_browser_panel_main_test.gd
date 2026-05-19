extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/faction_browser_panel.gd")
	if panel == null:
		_fail("Main scene does not expose FactionBrowserPanel")
		return
	if not panel.has_method("set_data") or not panel.has_method("select_faction") or not panel.has_method("visible_text"):
		_fail("FactionBrowserPanel does not expose required browser APIs")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var new_faction_id: String = "runtime-faction-browser-panel-test"
	var new_faction_name: String = "独立势力面板测试"
	var factions: Array = _array(game_state.get("factions")).duplicate(true)
	factions.append({
		"id": new_faction_id,
		"name": new_faction_name,
		"type": "起义军",
		"attitude": "敌对",
		"leader": "测试渠帅",
		"capital": "测试营垒",
		"strength": 4,
		"army": "3,000",
		"military_strength": 3000,
		"economy": 3,
		"cohesion": 51,
		"public_opinion": 44,
		"relations_text": "对大明关系 4 · 敌意 88",
		"territory": "1处：测试营垒",
		"description": "运行态新增势力用于验证独立势力浏览面板。"
	})
	game_state.set("factions", factions)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	panel.call("select_faction", new_faction_id)
	await get_tree().process_frame
	var text: String = str(panel.call("visible_text"))
	if not text.contains(new_faction_name) or not text.contains("测试渠帅") or not text.contains("测试营垒"):
		_fail("FactionBrowserPanel did not show runtime-added faction detail")
		return
	var panel_buttons: Dictionary = _dict(panel.get("faction_row_buttons"))
	if panel_buttons.get(new_faction_id, null) == null:
		_fail("FactionBrowserPanel did not keep a row button for the runtime-added faction")
		return

	print("[TianmingGodotTest] faction browser panel main scene test passed")
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
	print("[TianmingGodotTest] faction browser panel main scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction browser panel main scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
