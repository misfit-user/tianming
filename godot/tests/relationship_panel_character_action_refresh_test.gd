extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var relationship_panel: Node = _find_node_with_script(main, "res://scripts/relationship_panel.gd")
	if relationship_panel == null:
		_fail("Main scene does not expose the relationship panel")
		return
	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var setup: Dictionary = _prepare_character_relation(game_state)
	if setup.is_empty():
		_fail("Could not prepare emperor-target character relation")
		return
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var before_text: String = str(relationship_panel.call("visible_text"))
	if not before_text.contains(str(setup.get("target_name", ""))) or not before_text.contains("10"):
		_fail("Relationship panel did not show the seeded character relation")
		return

	var result: Dictionary = game_state.call("perform_character_action", str(setup.get("target_id", "")), "reward")
	if not result.get("ok", false):
		_fail("Character action failed: %s" % str(result.get("error", "")))
		return
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var after_text: String = str(relationship_panel.call("visible_text"))
	if not after_text.contains(str(setup.get("target_name", ""))) or not after_text.contains("16"):
		_fail("Relationship panel did not refresh the synced character relation after character action")
		return
	if not after_text.contains("由人物处置同步"):
		_fail("Relationship panel did not show the synced character relation description")
		return

	print("[TianmingGodotTest] relationship panel character-action refresh scene test passed")
	_finish(0)

func _prepare_character_relation(state: RefCounted) -> Dictionary:
	var characters: Array = _array(state.get("characters")).duplicate(true)
	if characters.size() < 2:
		return {}
	var emperor: Dictionary = _dict(characters[0]).duplicate(true)
	var emperor_id: String = str(emperor.get("id", ""))
	var emperor_name: String = str(emperor.get("name", ""))
	if emperor_id.is_empty() or emperor_name.is_empty():
		return {}
	var summary: Dictionary = _dict(state.get("summary")).duplicate(true)
	summary["emperor"] = emperor_name
	state.set("summary", summary)
	var target_id: String = ""
	var target_name: String = ""
	for i in range(characters.size()):
		var character: Dictionary = _dict(characters[i]).duplicate(true)
		if str(character.get("id", "")) == emperor_id:
			continue
		target_id = str(character.get("id", ""))
		target_name = str(character.get("name", ""))
		character["loyalty"] = 50
		characters[i] = character
		break
	if target_id.is_empty() or target_name.is_empty():
		return {}
	state.set("characters", characters)
	state.set("neitang_money", 100000)
	state.set("character_relations", [{
		"id": "test_character_action_relation_ui",
		"from": emperor_name,
		"to": target_name,
		"type": "君臣",
		"value": 10,
		"desc": "处置前关系"
	}])
	return {
		"target_id": target_id,
		"target_name": target_name
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
	print("[TianmingGodotTest] relationship panel character-action refresh scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] relationship panel character-action refresh scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
