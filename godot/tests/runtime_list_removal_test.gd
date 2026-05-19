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

	var removed_faction_id: String = _remove_last_row_with_id(game_state, "factions")
	var removed_character_id: String = _remove_last_row_with_id(game_state, "characters")
	if removed_faction_id.is_empty() or removed_character_id.is_empty():
		_fail("Could not remove runtime rows for list-removal test")
		return

	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var faction_panel: Node = _find_node_with_script(main, "res://scripts/faction_browser_panel.gd")
	if faction_panel == null:
		_fail("Main scene does not expose the faction browser panel")
		return
	var faction_buttons: Dictionary = _dict(faction_panel.get("faction_row_buttons"))
	if faction_buttons.has(removed_faction_id):
		_fail("Faction list kept a stale row for a removed runtime faction")
		return

	var character_panel: Node = _find_node_with_script(main, "res://scripts/character_browser_panel.gd")
	if character_panel == null:
		_fail("Main scene does not expose the character browser panel")
		return
	var character_buttons: Dictionary = _dict(character_panel.get("character_row_buttons"))
	if character_buttons.has(removed_character_id):
		_fail("Character list kept a stale row for a removed runtime character")
		return

	print("[TianmingGodotTest] runtime list removal scene test passed")
	_finish(0)

func _remove_last_row_with_id(state: RefCounted, property_name: String) -> String:
	var rows: Array = _array(state.get(property_name)).duplicate(true)
	for i in range(rows.size() - 1, -1, -1):
		var row: Dictionary = _dict(rows[i])
		var id: String = str(row.get("id", ""))
		if id.is_empty():
			continue
		rows.remove_at(i)
		state.set(property_name, rows)
		return id
	return ""

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
	print("[TianmingGodotTest] runtime list removal scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] runtime list removal scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
