extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var tabs: TabContainer = _find_first_tab_container(main)
	if tabs == null:
		_fail("Main scene does not expose a gameplay tab container")
		return
	if _find_tab(tabs, "关系") == null:
		_fail("Main scene does not expose the relationship tab")
		return

	var panel: Node = _find_node_with_script(main, "res://scripts/relationship_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the relationship panel")
		return
	if not panel.has_method("visible_text") or not panel.has_method("set_data"):
		_fail("Relationship panel does not expose set_data and visible_text")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null or not game_state.has_method("relationship_rows"):
		_fail("Main scene did not initialize relationship runtime rows")
		return
	var rows: Dictionary = game_state.call("relationship_rows")
	var character_rows: Array = _array(rows.get("characters", []))
	var faction_rows: Array = _array(rows.get("factions", []))
	if character_rows.size() < 50:
		_fail("Relationship UI did not receive character relationships")
		return
	if faction_rows.size() < 40:
		_fail("Relationship UI did not receive faction relationships")
		return

	var first_character_relation: Dictionary = _dict(character_rows[0])
	var first_faction_relation: Dictionary = _dict(faction_rows[0])
	var text: String = str(panel.call("visible_text"))
	if not text.contains(str(first_character_relation.get("from", ""))) or not text.contains(str(first_character_relation.get("to", ""))):
		_fail("Relationship panel omitted the first character relationship")
		return
	if not text.contains(str(first_faction_relation.get("from", ""))) or not text.contains(str(first_faction_relation.get("to", ""))):
		_fail("Relationship panel omitted the first faction relationship")
		return

	print("[TianmingGodotTest] relationship panel UI scene test passed")
	_finish(0)

func _find_tab(tabs: TabContainer, tab_name: String) -> Node:
	for i in range(tabs.get_child_count()):
		var child: Node = tabs.get_child(i)
		if child.name == tab_name:
			return child
	return null

func _find_first_tab_container(root: Node) -> TabContainer:
	if root is TabContainer:
		return root as TabContainer
	for child in root.get_children():
		var found: TabContainer = _find_first_tab_container(child)
		if found != null:
			return found
	return null

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
	print("[TianmingGodotTest] relationship panel UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] relationship panel UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
