extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/faction_detail_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the faction detail panel")
		return
	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var factions: Array = _array(game_state.get("factions"))
	if factions.size() < 2:
		_fail("Not enough factions for relationship UI test")
		return
	var first: Dictionary = _dict(factions[0])
	var second: Dictionary = _dict(factions[1])
	var first_name: String = str(first.get("name", ""))
	var second_name: String = str(second.get("name", ""))
	if first_name.is_empty() or second_name.is_empty():
		_fail("Faction rows did not expose names")
		return

	game_state.set("faction_relations", [{
		"id": "test_faction_relation_ui",
		"from": first_name,
		"to": second_name,
		"type": "trade",
		"value": 72,
		"desc": "测试用势力关系 UI"
	}])
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var relations_label: Label = panel.get("relations_label") as Label
	if relations_label == null:
		_fail("Faction detail panel does not expose relations_label")
		return
	var label_text: String = relations_label.text
	if not label_text.contains(second_name) or not label_text.contains("72") or not label_text.contains("测试用势力关系 UI"):
		_fail("Faction detail label did not display top-level faction relationship")
		return

	var visible: String = str(panel.call("visible_text"))
	if not visible.contains(second_name) or not visible.contains("72") or not visible.contains("测试用势力关系 UI"):
		_fail("Faction detail visible_text omitted top-level faction relationship")
		return

	print("[TianmingGodotTest] faction relationship summary UI scene test passed")
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
	print("[TianmingGodotTest] faction relationship summary UI scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] faction relationship summary UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
