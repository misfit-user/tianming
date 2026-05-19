extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/audience_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the audience panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var character_select: OptionButton = panel.get("character_select") as OptionButton
	var topic_select: OptionButton = panel.get("topic_select") as OptionButton
	if character_select == null or topic_select == null:
		_fail("Audience panel does not expose character and topic selectors")
		return
	if character_select.item_count < 2 or topic_select.item_count < 2:
		_fail("Audience selection persistence test requires at least two characters and two topics")
		return

	character_select.select(1)
	character_select.emit_signal("item_selected", 1)
	topic_select.select(1)
	topic_select.emit_signal("item_selected", 1)
	var selected_character_id: String = str(character_select.get_selected_metadata())
	var selected_topic_id: String = str(topic_select.get_selected_metadata())
	if selected_character_id.is_empty() or selected_topic_id.is_empty():
		_fail("Audience test could not capture selected character and topic")
		return

	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	if str(character_select.get_selected_metadata()) != selected_character_id:
		_fail("Audience panel did not preserve selected character across runtime refresh")
		return
	if str(topic_select.get_selected_metadata()) != selected_topic_id:
		_fail("Audience panel did not preserve selected topic across runtime refresh")
		return

	var characters: Array = _array(game_state.get("characters")).duplicate(true)
	for i in range(characters.size() - 1, -1, -1):
		if str(_dict(characters[i]).get("id", "")) == selected_character_id:
			characters.remove_at(i)
			break
	game_state.set("characters", characters)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var recovered_character_id: String = str(character_select.get_selected_metadata())
	if recovered_character_id.is_empty() or recovered_character_id == selected_character_id:
		_fail("Audience panel kept a stale selected character after runtime removal")
		return
	if _character_by_id(characters, recovered_character_id).is_empty():
		_fail("Audience panel recovered to a character that is not in runtime state")
		return

	print("[TianmingGodotTest] audience selection persistence scene test passed")
	_finish(0)

func _character_by_id(characters: Array, character_id: String) -> Dictionary:
	for raw in characters:
		var character: Dictionary = _dict(raw)
		if str(character.get("id", "")) == character_id:
			return character
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
	print("[TianmingGodotTest] audience selection persistence scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] audience selection persistence scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
