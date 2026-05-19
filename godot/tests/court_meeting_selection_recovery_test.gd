extends Node

const MainScene := preload("res://scenes/main.tscn")

func _ready() -> void:
	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame

	var panel: Node = _find_node_with_script(main, "res://scripts/court_meeting_panel.gd")
	if panel == null:
		_fail("Main scene does not expose the court meeting panel")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return

	var removed_topic_id: String = str(panel.get("selected_topic_id"))
	var selected_participants: Array = _array(panel.get("selected_participant_ids"))
	if removed_topic_id.is_empty() or selected_participants.is_empty():
		_fail("Court meeting panel did not select an initial topic and participants")
		return
	var removed_participant_id: String = str(selected_participants[0])

	var topics: Array = _array(game_state.get("court_meeting_topics")).duplicate(true)
	if topics.size() < 2:
		_fail("Court meeting selection recovery test requires at least two topics")
		return
	for i in range(topics.size() - 1, -1, -1):
		if str(_dict(topics[i]).get("id", "")) == removed_topic_id:
			topics.remove_at(i)
			break

	var characters: Array = _array(game_state.get("characters")).duplicate(true)
	if characters.size() < 4:
		_fail("Court meeting selection recovery test requires at least four characters")
		return
	for i in range(characters.size() - 1, -1, -1):
		if str(_dict(characters[i]).get("id", "")) == removed_participant_id:
			characters.remove_at(i)
			break

	game_state.set("court_meeting_topics", topics)
	game_state.set("characters", characters)
	main.call("_refresh_runtime_bar")
	await get_tree().process_frame

	var recovered_topic_id: String = str(panel.get("selected_topic_id"))
	if recovered_topic_id.is_empty() or recovered_topic_id == removed_topic_id:
		_fail("Court meeting panel kept a stale selected topic after runtime removal")
		return
	if _topic_by_id(topics, recovered_topic_id).is_empty():
		_fail("Court meeting panel recovered to a topic that is not in runtime state")
		return
	for raw_id in _array(panel.get("selected_participant_ids")):
		var participant_id: String = str(raw_id)
		if participant_id == removed_participant_id:
			_fail("Court meeting panel kept a stale participant after runtime removal")
			return
		if _character_by_id(characters, participant_id).is_empty():
			_fail("Court meeting panel kept a participant that is not in runtime state")
			return

	print("[TianmingGodotTest] court meeting selection recovery scene test passed")
	_finish(0)

func _topic_by_id(topics: Array, topic_id: String) -> Dictionary:
	for raw in topics:
		var topic: Dictionary = _dict(raw)
		if str(topic.get("id", "")) == topic_id:
			return topic
	return {}

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
	print("[TianmingGodotTest] court meeting selection recovery scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] court meeting selection recovery scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
