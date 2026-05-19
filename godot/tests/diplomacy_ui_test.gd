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
	var target_id: String = _prepare_target_faction(game_state)
	if target_id.is_empty():
		_fail("No targetable faction was found")
		return
	var action_points_before: int = int(game_state.get("action_points"))

	panel.emit_signal("diplomacy_requested", "send_envoy", target_id)
	await get_tree().process_frame

	if int(game_state.get("action_points")) != action_points_before - 1:
		_fail("Diplomacy UI request did not spend one action point")
		return
	if _array(game_state.get("diplomacy_history")).is_empty():
		_fail("Diplomacy UI request did not record diplomacy history")
		return

	print("[TianmingGodotTest] diplomacy UI scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _find_node_with_script(root: Node, script_path: String) -> Node:
	var script: Script = root.get_script()
	if script != null and script.resource_path == script_path:
		return root
	for child in root.get_children():
		var found: Node = _find_node_with_script(child, script_path)
		if found != null:
			return found
	return null

func _prepare_target_faction(state: RefCounted) -> String:
	var factions: Array = _array(state.get("factions")).duplicate(true)
	for i in range(factions.size()):
		var faction: Dictionary = _dict(factions[i]).duplicate(true)
		var id: String = str(faction.get("id", ""))
		if id.is_empty() or str(faction.get("name", "")).contains("明"):
			continue
		faction["relation_to_player"] = 20
		faction["hostility"] = 60
		factions[i] = faction
		state.set("factions", factions)
		return id
	return ""

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] diplomacy UI scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] diplomacy UI scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
