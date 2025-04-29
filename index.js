import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

createApp({
  data() {
    return {
      myMessage: "",
      sending: false,
      channels: ["designftw"],
      group: "",
      activeChannel: null,
      activeChatName: "",
      rename: "",
      renameObjects: [],
      chatType: "group", 
      directMessageUser: "",
      activeSender: null, 
      dmhis: [], 
      last: {}, 
      pinnedMess: {}, 
      showPinned: false, 
      channel2: null, 
      channel1: null, 
    };
  },

  methods: {

    switchToGroupChat() {
      this.chatType = "group";
      if (this.channel1) {
        this.activeChannel = this.channel1;
      } else {
        this.activeChannel = null;
      }
    },


    switchToDirectMessages() {
      this.chatType = "direct";
      if (this.channel2) {
        this.activeChannel = this.channel2;
        this.activeChatName = `Chat with ${this.activeChannel}`;
      } else {
        this.activeChannel = null;
        this.activeChatName = "";
      }
    },

    async sendMessage(session) {
      if (!this.myMessage || !this.activeChannel) return;

      this.sending = true;

     
      const messageData = {
        content: this.myMessage,
        published: Date.now(),
        pinned: false, 
      };

      if (this.chatType === "direct") {
        messageData.sender = session.actor;
        if (this.activeChannel !== session.actor && 
            !this.dmhis.includes(this.activeChannel)) {
          this.dmhis.push(this.activeChannel);
        }

        this.last[this.activeChannel] = {
          content: this.myMessage,
          timestamp: Date.now()
        };
      }

      await this.$graffiti.put(
        {
          value: messageData,
          channels: [this.activeChannel],
        },
        session
      );

      this.sending = false;
      this.myMessage = "";
      await this.$nextTick();
      if (this.$refs.messageInput) {
        this.$refs.messageInput.focus();
      }
    },

    async createGroupChat(session) {
      if (!this.group.trim()) {
        alert("Please enter group chat name");
        return;
      }
      const channel = crypto.randomUUID();
      await this.$graffiti.put(
        {
          value: {
            activity: "Create",
            object: {
              type: "Group Chat",
              name: this.group || "New Group Chat",
              channel,
            },
          },
          channels: ["designftw"],
          allowed: undefined,
        },
        session
      );
      alert(`Created group "${this.group}" with channel: ${channel}`);
      this.group = "";
    },

    joinGroupChat(object) {
      this.activeChannel = object.value.object.channel;
      this.activeChatName = object.value.object.name;
    
      this.channel1 = this.activeChannel;
      this.showPinned = false; 
    },


    startDirectMessage(session) {
      if (!this.directMessageUser.trim()) {
        alert("Please enter a user ID");
        return;
      }

      this.activeChannel = this.directMessageUser;
      this.activeChatName = `Message to ${this.directMessageUser}`;

      this.channel2 = this.activeChannel;
      this.activeSender = null;
      this.showPinned = false;

      if (!this.dmhis.includes(this.directMessageUser)) {
        this.dmhis.push(this.directMessageUser);
      }
      
      this.directMessageUser = "";
    },


    viewMyInbox(session) {
      this.activeChannel = session.actor;
      this.activeChatName = "My Inbox";
      this.channel2 = this.activeChannel;
      this.activeSender = null;
      this.showPinned = false;
    },
    

    openConversation(userId, session) {
      this.activeChannel = userId;
      this.activeChatName = `Chat with ${userId}`;
      this.channel2 = this.activeChannel;
      this.activeSender = null;
      this.showPinned = false;
    },

    filterBySender(sender) {
      if (this.activeSender === sender) {
        this.activeSender = null;
      } else {
        this.activeSender = sender;
      }
    },

    async editMessage(message) {
      const newContent = prompt("Edit message:", message.value.content);
      if (newContent && newContent !== message.value.content) {
        await this.$graffiti.patch(
          {
            value: [
              {
                op: "replace",
                path: "/content",
                value: newContent,
              },
            ],
          },
          message,
          this.$graffitiSession.value
        );
        
        if (message.value.pinned && this.pinnedMess[this.activeChannel]) {
          const pinnedIndex = this.pinnedMess[this.activeChannel].findIndex(
            pin => pin.url === message.url
          );
          
          if (pinnedIndex >= 0) {
            this.pinnedMess[this.activeChannel][pinnedIndex].value.content = newContent;
          }
        }
      }
    },

    async deleteMessage(message) {
      if (confirm("Do you want to delete")) {
        await this.$graffiti.delete(message, this.$graffitiSession.value);
        if (message.value.pinned && this.pinnedMess[this.activeChannel]) {
          const pinnedIndex = this.pinnedMess[this.activeChannel].findIndex(
            pin => pin.url === message.url
          );
          
          if (pinnedIndex >= 0) {
            this.pinnedMess[this.activeChannel].splice(pinnedIndex, 1);
          }
        }
      }
    },

    async renameGroupChat(session) {
      if (!this.rename.trim()) {
        alert("Enter new name");
        return;
      }

      await this.$graffiti.put(
        {
          value: {
            name: this.rename.trim(),
            describes: this.activeChannel,
          },
          channels: ["designftw"],
        },
        session
      );

      const ind = this.renameObjects.findIndex(
        (obj) => obj.value.describes === this.activeChannel
      );
      if (ind !== -1) {
        this.renameObjects[ind].value.name = this.rename.trim();
      } else {
        this.renameObjects.push({
          value: {
            name: this.rename.trim(),
            describes: this.activeChannel,
          },
        });
      }

      this.activeChatName = this.rename.trim();
      this.rename = "";
    },


    getUniqueSenders(messages) {
      if (!messages) return [];
      const senders = [
        ...new Set(
          messages
            .filter((msg) => msg.value.sender) 
            .map((msg) => msg.value.sender)
        ),
      ];
      

      senders.forEach(sender => {
        if (!this.dmhis.includes(sender) && 
            sender !== this.$graffitiSession.value?.actor) {
          this.dmhis.push(sender);
        }
        
  
        const lastMessage = messages
          .filter(msg => msg.value.sender === sender)
          .sort((a, b) => b.value.published - a.value.published)[0];
          
        if (lastMessage) {
          this.last[sender] = {
            content: lastMessage.value.content,
            timestamp: lastMessage.value.published
          };
        }
      });
      
      return senders;
    },

    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    
    sortedConversations() {
      return this.dmhis.sort((a, b) => {
        const timeA = this.last[a]?.timestamp;
        const timeB = this.last[b]?.timestamp;
        return timeB - timeA; 
      });
    },
    

    processIncomingMessages(messages, session) {
      if (!messages || !session) return;
      
      messages.forEach(message => {
        const sender = message.value.sender;
        if (!sender || sender === session.actor) return;
        if (!this.dmhis.includes(sender)) {
          this.dmhis.push(sender);
        }

        if (!this.last[sender] || 
            message.value.published > this.last[sender].timestamp) {
          this.last[sender] = {
            content: message.value.content,
            timestamp: message.value.published
          };
        }
      });
    },

    togglepinnedMess() {
      this.showPinned = !this.showPinned;
    },
    

    async togglePinMessage(message, session) {
      const newPinnedStatus = !message.value.pinned;
      await this.$graffiti.patch(
        {
          value: [
            {
              op: "replace",
              path: "/pinned",
              value: newPinnedStatus,
            },
          ],
        },
        message,
        session
      );
      message.value.pinned = newPinnedStatus;
      if (!this.pinnedMess[this.activeChannel]) {
        this.pinnedMess[this.activeChannel] = [];
      }
      

      if (newPinnedStatus) {
      
        const existingIndex = this.pinnedMess[this.activeChannel].findIndex(
          pin => pin.url === message.url
        );
        
        if (existingIndex === -1) {
          this.pinnedMess[this.activeChannel].push(message);
        }
      } 
  
      else {
        const indexToRemove = this.pinnedMess[this.activeChannel].findIndex(
          pin => pin.url === message.url
        );
        
        if (indexToRemove !== -1) {
          this.pinnedMess[this.activeChannel].splice(indexToRemove, 1);
        }
      }
    },
    

    getPinnedCount() {
      if (!this.activeChannel || !this.pinnedMess[this.activeChannel]) {
        return 0;
      }
      return this.pinnedMess[this.activeChannel].length;
    },
    

    isPinned(messageUrl) {
      if (!this.activeChannel || !this.pinnedMess[this.activeChannel]) {
        return false;
      }
      
      return this.pinnedMess[this.activeChannel].some(
        pin => pin.url === messageUrl
      );
    }
  },
  directives: {
    focus: {
      mounted(el) {
        el.focus();
      },
    },
  },
})
  .use(GraffitiPlugin, {
    graffiti: new GraffitiLocal(),
    // graffiti: new GraffitiRemote(),
  })
  .mount("#app");