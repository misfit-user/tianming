extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/diplomacy_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the diplomacy panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var removed_faction_id: String = str(panel.get("selected_faction_id"))
	if removed_faction_id.is_empty():
		_fail("Diplomacy panel did not select an initial target faction")
		return

	var factions: Array = _array(game_state.get("factions")).duplicate(true)
	if factions.size() < 2:
		_fail("Diplomacy selection recovery test requires at least two factions")
		return
	var removed: bool = false
	for i in range(factions.size() - 1, -1, -1):
		var faction: Dictionary = _dict(factions[i])
		if str(faction.get("id", "")) == removed_faction_id:
			factions.remove_at(i)
			removed = true
			break
	if not removed:
		_fail("Could not remove selected diplomacy target faction from runtime state")
		return

	game_state.set("factions", factions)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var recovered_faction_id: String = str(panel.get("selected_faction_id"))
	if recovered_faction_id.is_empty() or recovered_faction_id == removed_faction_id:
		_fail("Diplomacy panel kept a stale selected faction after runtime removal")
		return
	if _faction_by_id(factions, recovered_faction_id).is_empty():
		_fail("Diplomacy panel recovered to a faction that is not in runtime state")
		return

	print("[TianmingGodotTest] diplomacy selection recovery scene test passed")
	_finish(0)

func _faction_by_id(factions: Array, faction_id: String) -> Dictionary:
	for raw in factions:
		var faction: Dictionary = _dict(raw)
		if str(faction.get("id", "")) == faction_id:
			return faction
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
	print("[TianmingGodotTest] diplomacy selection recovery scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy selection recovery scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
