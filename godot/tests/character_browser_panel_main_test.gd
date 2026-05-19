extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/character_browser_panel.gd")
	if panel == null:
		_fail("Main scene does not expose CharacterBrowserPanel")
		return
	if not panel.has_method("set_data") or not panel.has_method("select_character") or not panel.has_method("visible_text"):
		_fail("CharacterBrowserPanel does not expose required browser APIs")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var new_character_id: String = "runtime-character-browser-panel-test"
	var new_character_name: String = "独立人物面板测试"
	var characters: Array = _array(game_state.get("characters")).duplicate(true)
	characters.append({
		"id": new_character_id,
		"name": new_character_name,
		"title": "新授御史",
		"official_title": "新授御史",
		"gender": "男",
		"age": 35,
		"faction": "明朝",
		"party": "无党",
		"social_class": "士绅",
		"location": "京师",
		"loyalty": 66,
		"ambition": 41,
		"intelligence": 73,
		"administration": 69,
		"valor": 38,
		"military": 36,
		"diplomacy": 64,
		"charisma": 57,
		"benevolence": 55,
		"integrity": 72,
		"traits_text": "谨慎、清望",
		"bio": "运行态新增人物用于验证独立人物浏览面板。"
	})
	game_state.set("characters", characters)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	panel.call("select_character", new_character_id)
	await get_tree().process_frame
	var text: String = str(panel.call("visible_text"))
	if not text.contains(new_character_name) or not text.contains("新授御史"):
		_fail("CharacterBrowserPanel did not show runtime-added character detail")
		return
	var panel_buttons: Dictionary = _dict(panel.get("character_row_buttons"))
	if panel_buttons.get(new_character_id, null) == null:
		_fail("CharacterBrowserPanel did not keep a row button for the runtime-added character")
		return

	print("[TianmingGodotTest] character browser panel main scene test passed")
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
	print("[TianmingGodotTest] character browser panel main scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] character browser panel main scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
