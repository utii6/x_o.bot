from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters
import telegram

TOKEN = "7955735266:AAGSqtTDWtCbnjYVZIScdKqIQkLFnEiZHJY"
CHANNEL = "@NeIEOgnefpk1MWIy"  # معرف القناة

# تحقق من الاشتراك
async def is_subscribed(bot: telegram.Bot, user_id):
    try:
        member = await bot.get_chat_member(CHANNEL, user_id)
        if member.status in ["creator", "administrator", "member"]:
            return True
        else:
            return False
    except:
        return False

# رسالة الترحيب واشتراك إجباري
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if await is_subscribed(context.bot, user_id):
        keyboard = [
            [InlineKeyboardButton("🎮 العب XO", web_app={"url": "https://x-o-bot.onrender.com"})]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            f"أهلاً بك {update.message.from_user.first_name} 👋\nاضغط على الزر للعب XO!",
            reply_markup=reply_markup
        )
    else:
        keyboard = [
            [InlineKeyboardButton("مَـدار💎", url=f"https://t.me/+NeIEOgnefpk1MWIy")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "⚠️ يالطيـب اشترك وارسـل /start :.",
            reply_markup=reply_markup
        )

# استقبال بيانات اللعبة
async def handle_webapp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = update.message.web_app_data.data
    await update.message.reply_text(f"📢 اللعبة أرسلت: {data}")

app = Application.builder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))
app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp))

print("🤖 Bot running...")
app.run_polling()
