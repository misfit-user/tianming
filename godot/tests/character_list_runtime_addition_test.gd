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

	var new_character_id: String = "runtime-added-character-ui-test"
	var new_character_name: String = "运行态新增人物"
	var characters: Array = _array(game_state.get("characters")).duplicate(true)
	characters.append({
		"id": new_character_id,
		"name": new_character_name,
		"title": "新授参议",
		"official_title": "新授参议",
		"gender": "男",
		"age": 32,
		"faction": "明朝",
		"party": "无党",
		"social_class": "士绅",
		"location": "京师",
		"loyalty": 64,
		"ambition": 48,
		"intelligence": 70,
		"administration": 68,
		"valor": 40,
		"military": 38,
		"diplomacy": 66,
		"charisma": 58,
		"benevolence": 55,
		"integrity": 62,
		"traits_text": "谨慎",
		"bio": "运行态新增人物测试。"
	})
	game_state.set("characters", characters)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var browser_panel: Node = _find_node_with_script(main, "res://scripts/character_browser_panel.gd")
	if browser_panel == null:
		_fail("Main scene does not expose the character browser panel")
		return

	var buttons: Dictionary = _dict(browser_panel.get("character_row_buttons"))
	var button: Button = buttons.get(new_character_id, null) as Button
	if button == null:
		_fail("Runtime-added character did not receive a character list row")
		return

	button.emit_signal("pressed")
	await get_tree().process_frame
	var panel: Node = _find_node_with_script(main, "res://scripts/character_detail_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the character detail panel")
		return
	var current: Dictionary = _dict(panel.get("current_character"))
	if str(current.get("id", "")) != new_character_id or str(current.get("name", "")) != new_character_name:
		_fail("Runtime-added character row did not select the live character detail")
		return

	print("[TianmingGodotTest] character list runtime addition scene test passed")
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
	print("[TianmingGodotTest] character list runtime addition scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] character list runtime addition scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
