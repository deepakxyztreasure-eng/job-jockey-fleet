import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { JobMessage } from '../../types';
import { fetchJobMessages, sendChatMessage } from '../../api/chat';
import { supabase } from '../../api/supabase';

interface DispatchChatScreenProps {
  driverId: string;
  driverName: string;
  userId: string;
}

export const DispatchChatScreen: React.FC<DispatchChatScreenProps> = ({
  driverId,
  driverName,
  userId,
}) => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    loadMessages();

    // Setup Supabase Realtime channel for instant dispatch broadcast & DB events
    const channelName = `dispatch-chat-${driverId}`;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'dispatch_message' }, (payload: any) => {
        if (payload?.payload) {
          const newMsg = payload.payload as JobMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_messages',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload: any) => {
          const newMsg = payload.new as JobMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  const loadMessages = async () => {
    const data = await fetchJobMessages(driverId);
    setMessages(data);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');

    const tempId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const msg: JobMessage = {
      id: tempId,
      driver_id: driverId,
      sender_id: userId,
      sender_name: driverName,
      sender_role: 'driver',
      message_text: text,
      created_at: new Date().toISOString(),
    };

    // Show immediately in driver UI
    setMessages((prev) => [...prev, msg]);

    // Broadcast over WebSocket directly to Web Live Dispatch
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'dispatch_message',
        payload: msg,
      });
    }

    // Also persist to DB in background
    sendChatMessage(driverId, userId, driverName, text)
      .then((saved) => {
        if (saved?.id && saved.id !== tempId) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
        }
      })
      .catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 48) }]}>
        <View style={styles.avatar}>
          <Ionicons name="headset" size={18} color={Colors.white} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Jodha Dispatch Team</Text>
          <Text style={styles.headerSubtitle}>Real-time two-way operations chat</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMe = item.sender_role === 'driver';
          return (
            <View style={[styles.bubbleWrapper, isMe ? styles.myWrapper : styles.theirWrapper]}>
              {!isMe && <Text style={styles.senderLabel}>{item.sender_name} (Dispatch)</Text>}
              <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                <Text style={[styles.bubbleText, isMe && styles.myBubbleText]}>
                  {item.message_text}
                </Text>
              </View>
              <Text style={styles.timestamp}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No messages yet.</Text>
            <Text style={styles.emptySubtext}>Ask dispatch a question or report delays without calling.</Text>
          </View>
        }
      />

      {/* Input Row */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type message to dispatch..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Ionicons name="send" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  messageList: {
    padding: 16,
    paddingBottom: 24,
  },
  bubbleWrapper: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 19,
  },
  myBubbleText: {
    color: Colors.white,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    marginHorizontal: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 220,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
