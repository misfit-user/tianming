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

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	if not game_state.has_method("appoint_character") or not game_state.has_method("character_by_name"):
		_fail("GameState does not expose live appointment APIs")
		return

	var stale_character: Dictionary = game_state.call("character_by_name", "孙承宗")
	if stale_character.is_empty():
		_fail("Could not find appointment test character")
		return
	var character_id: String = str(stale_character.get("id", ""))
	var old_title: String = str(stale_character.get("official_title", stale_character.get("title", "")))

	var result: Dictionary = game_state.call("appoint_character", character_id, "liaodong_dushi")
	if not result.get("ok", false):
		_fail("Appointment failed: %s" % str(result.get("error", "")))
		return
	await get_tree().process_frame

	var updated: Dictionary = game_state.call("character_by_id", character_id)
	var new_title: String = str(updated.get("official_title", updated.get("title", "")))
	if new_title.is_empty() or new_title == old_title:
		_fail("Appointment did not create a detectable live character title change")
		return

	var selected_button: Button = Button.new()
	main.call("_on_character_selected", stale_character, selected_button)
	await get_tree().process_frame

	var displayed: Dictionary = _dict(panel.get("current_character"))
	var displayed_title: String = str(displayed.get("official_title", displayed.get("title", "")))
	if displayed_title != new_title:
		_fail("Character selection reused stale list row data instead of live runtime character")
		return

	print("[TianmingGodotTest] character selection live refresh scene test passed")
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

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] character selection live refresh scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] character selection live refresh scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
