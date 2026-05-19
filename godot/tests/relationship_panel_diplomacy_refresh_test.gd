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

	var setup: Dictionary = _prepare_target_faction(game_state)
	if setup.is_empty():
		_fail("Could not prepare target faction")
		return
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var before_text: String = str(relationship_panel.call("visible_text"))
	if not before_text.contains("-40"):
		_fail("Relationship panel did not show the seeded faction relation")
		return

	var result: Dictionary = game_state.call("issue_diplomacy_action", "send_envoy", str(setup.get("target_id", "")))
	if not result.get("ok", false):
		_fail("Diplomacy action failed: %s" % str(result.get("error", "")))
		return
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var after_text: String = str(relationship_panel.call("visible_text"))
	if not after_text.contains(str(setup.get("target_name", ""))) or not after_text.contains("-18"):
		_fail("Relationship panel did not refresh the synced faction relation after diplomacy")
		return
	if not after_text.contains("由势力态势同步"):
		_fail("Relationship panel did not show the synced relation description")
		return

	print("[TianmingGodotTest] relationship panel diplomacy refresh scene test passed")
	_finish(0)

func _prepare_target_faction(state: RefCounted) -> Dictionary:
	var factions: Array = _array(state.get("factions")).duplicate(true)
	var player_index: int = -1
	var target_index: int = -1
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i])
		var faction_name: String = str(faction.get("name", ""))
		if player_index < 0 and (faction_name == "大明" or faction_name.contains("明")):
			player_index = i
		elif target_index < 0 and not faction_name.contains("明"):
			target_index = i
	if player_index < 0 or target_index < 0:
		return {}
	var player: Dictionary = _dict(factions[player_index])
	var target: Dictionary = _dict(factions[target_index]).duplicate(true)
	target["relation_to_player"] = 20
	target["hostility"] = 60
	factions[target_index] = target
	state.set("factions", factions)
	state.set("faction_relations", [{
		"id": "test_relationship_panel_diplomacy",
		"from": str(player.get("name", "")),
		"to": str(target.get("name", "")),
		"type": "neutral",
		"value": -40,
		"desc": "外交前关系"
	}])
	return {
		"target_id": str(target.get("id", "")),
		"target_name": str(target.get("name", ""))
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
	print("[TianmingGodotTest] relationship panel diplomacy refresh scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] relationship panel diplomacy refresh scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
