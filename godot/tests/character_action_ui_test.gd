extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/character_detail_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the character detail panel")
		return
	if not panel.has_signal("character_action_requested") or not panel.has_method("visible_text"):
		_fail("Character detail panel does not expose action signal and visible_text")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	if not game_state.has_method("character_actions"):
		_fail("GameState does not expose character actions for UI")
		return
	var characters: Array = _array(game_state.get("characters"))
	if characters.is_empty():
		_fail("Character UI does not have characters")
		return
	var character_id: String = str(_dict(characters[0]).get("id", ""))
	panel.emit_signal("character_action_requested", character_id, "inspect")
	await get_tree().process_frame
	if _array(game_state.get("character_action_history")).size() != 1:
		_fail("Character detail UI did not route action into game state")
		return
	var text: String = str(panel.call("visible_text"))
	if not text.contains("人物处置") or not text.contains(str(_dict(characters[0]).get("name", ""))):
		_fail("Character detail panel did not display action result")
		return

	print("[TianmingGodotTest] character action UI scene test passed")
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
	print("[TianmingGodotTest] character action UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] character action UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
