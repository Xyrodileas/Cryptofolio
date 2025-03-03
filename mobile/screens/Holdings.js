import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect } from "react";
import { Text, StyleSheet, View, Image, Dimensions, ScrollView, Modal, TouchableOpacity, TextInput, RefreshControl, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import changeNavigationBarColor from "react-native-navigation-bar-color";
import LinearGradient from "react-native-linear-gradient";
import { globalColors, globalStyles } from "../styles/global";
import { ThemeContext } from "../utils/theme";
import { empty, separateThousands, abbreviateNumber, epoch, capitalizeFirstLetter, wait, currencies } from "../utils/utils";

const screenWidth = Dimensions.get("screen").width;
const screenHeight = Dimensions.get("screen").height;

export default function Holdings({ navigation }) {
	const { theme } = React.useContext(ThemeContext);

	const holdingsRef = React.createRef();

	const loadingText = "Loading...";

	const [pageKey, setPageKey] = React.useState(epoch());

	const [refreshing, setRefreshing] = React.useState(false);

	const [modal, setModal] = React.useState(false);
	const [modalMessage, setModalMessage] = React.useState();
	const [action, setAction] = React.useState("create");
	const [coinID, setCoinID] = React.useState();
	const [coinAmount, setCoinAmount] = React.useState();

	const [holdingsValue, setHoldingsValue] = React.useState(loadingText);

	const [holdingsData, setHoldingsData] = React.useState([<Text key="loading" style={[styles.loadingText, styles.headerText, styles[`headerText${theme}`]]}>Loading...</Text>]);

	useEffect(() => {
		setInterval(() => {
			if(navigation.isFocused()) {
				getHoldings();
			}
		}, 10000)
	}, []);

	useEffect(() => {
		setHoldingsData([<Text key="loading" style={[styles.loadingText, styles.headerText, styles[`headerText${theme}`]]}>Loading...</Text>]);

		setPageKey(epoch());

		getHoldings();
	}, [theme]);

	const onRefresh = React.useCallback(() => {
		setRefreshing(true);
		getHoldings();
		wait(750).then(() => setRefreshing(false));
	}, []);

	return (
		<ScrollView style={[styles.page, styles[`page${theme}`]]} key={pageKey} contentContainerStyle={{ padding:20 }} nestedScrollEnabled={true} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[globalColors[theme].accentFirst]} progressBackgroundColor={globalColors[theme].mainFirst}/>}>
			<Modal animationType="fade" visible={modal} onRequestClose={() => { setAction("create"); setCoinID(); setCoinAmount(); setModalMessage(); setModal(false)}} transparent={false}>
				<View style={[styles.modalWrapper, styles[`modalWrapper${theme}`]]}>
					<View stlye={[styles.modal, styles[`modal${theme}`]]}>
						<TextInput style={[styles.input, styles[`input${theme}`], (action !== "create") ? { backgroundColor:globalColors[theme].mainFourth, color:globalColors[theme].mainContrastLight } : null]} placeholder={"Coin ID... (e.g. Bitcoin)"} onChangeText={(value) => { setCoinID(value)}} value={coinID} placeholderTextColor={globalColors[theme].mainContrastLight} editable={(action === "create")} spellCheck={false}/>
						<TextInput style={[styles.input, styles[`input${theme}`]]} placeholder={"Amount... (e.g. 2.5)"} onChangeText={(value) => { setCoinAmount(value)}} value={coinAmount} placeholderTextColor={globalColors[theme].mainContrastLight}/>
						<View style={styles.buttonWrapper}>
							<TouchableOpacity style={[styles.button, styles[`button${theme}`]]} onPress={() => { setAction("create"); setCoinID(); setCoinAmount(); setModalMessage(); setModal(false)}}>
								<Text style={styles.text}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity style={[styles.button, styles.buttonConfirm, styles[`buttonConfirm${theme}`]]} onPress={() => { createHolding(coinID, coinAmount)}}>
								<Text style={styles.text}>Confirm</Text>
							</TouchableOpacity>
						</View>
						{ !empty(modalMessage) &&
							<View style={styles.modalMessageWrapper}>
								<Text style={styles.modalMessage}>{modalMessage}</Text>
							</View>
						}
					</View>
					{ action !== "create" &&
						<TouchableOpacity style={[styles.button, styles.buttonDelete]} onPress={() => { deleteHolding(coinID)}}>
							<Text style={styles.text}>Remove Asset</Text>
						</TouchableOpacity>
					}
				</View>
			</Modal>
			<LinearGradient style={[styles.card, { marginBottom:20 }]} colors={globalColors[theme].greenerGradient} useAngle={true} angle={45}>
				<Text style={[styles.cardText, styles[`cardText${theme}`]]}>{holdingsValue}</Text>
			</LinearGradient>
			<ScrollView ref={holdingsRef} style={[styles.tableWrapper, styles[`tableWrapper${theme}`]]} contentContainerStyle={{ paddingTop:10, paddingBottom:10 }} nestedScrollEnabled={true}>
				{ !empty(holdingsData) &&
					holdingsData.map(row => {
						return row;
					})
				}
			</ScrollView>
			<LinearGradient style={[styles.card, { marginTop:20 }]} colors={globalColors[theme].calmGradient} useAngle={true} angle={45}>
				<TouchableOpacity onPress={() => { setAction("create"); setModal(true)}}>
					<Text style={[styles.cardText, styles[`cardText${theme}`]]}>Add Coin</Text>
				</TouchableOpacity>
			</LinearGradient>
			<StatusBar style={theme === "Dark" ? "light" : "dark"}/>
		</ScrollView>
	);

	async function createHolding(id, amount) {
		if(!empty(id) && !empty(amount) && !isNaN(amount)) {
			setModalMessage("Checking coin...");

			id = id.toLowerCase().replaceAll(" ", "-");

			let api = await AsyncStorage.getItem("api");
			let token = await AsyncStorage.getItem("token");

			let endpoint = "https://api.coingecko.com/api/v3/coins/" + id;

			fetch(endpoint, {
				method: "GET",
				headers: {
					Accept: "application/json", "Content-Type": "application/json"
				}
			})
			.then((response) => {
				return response.json();
			})
			.then(async (coin) => {
				if(!empty(coin.error)) {
					setModalMessage("Coin not found. Make sure the ID is right.");
				} else {
					let symbol = coin.symbol;

					let endpoint = api + "holdings/create.php";
					let method = "POST";
					let body = { token:token, id:id, symbol:symbol, amount:amount };

					if(action === "update") {
						endpoint = api + "holdings/update.php";
						method = "PUT";
						body = { token:token, id:id, amount:amount };
					}

					fetch(endpoint, {
						method: method,
						body: JSON.stringify(body),
						headers: {
							Accept: "application/json", "Content-Type": "application/json"
						}
					})
					.then((json) => {
						return json.json();
					})
					.then(async (response) => {
						if("message" in response) {
							setModal(false);
							setModalMessage();
							setAction("create");
							setCoinID();
							setCoinAmount();
							getHoldings();
						} else {
							setModalMessage(response.error);
						}
					}).catch(error => {
						console.log(error);
					});
				}
			}).catch(error => {
				console.log(error);
			});
		} else {
			setModalMessage("Both fields must be filled out.");
		}
	}

	async function deleteHolding(id) {
		if(!empty(id)) {
			id = id.toLowerCase().replaceAll(" ", "-");

			let api = await AsyncStorage.getItem("api");
			let token = await AsyncStorage.getItem("token");

			let endpoint = api + "holdings/delete.php";

			let body = { token:token, id:id };

			fetch(endpoint, {
				method: "DELETE",
				body: JSON.stringify(body),
				headers: {
					Accept: "application/json", "Content-Type": "application/json"
				}
			})
			.then((json) => {
				return json.json();
			})
			.then(async (response) => {
				if("message" in response) {
					setModal(false);
					setModalMessage();
					setAction("create");
					setCoinID();
					setCoinAmount();
					getHoldings();
				} else {
					setModalMessage(response.error);
				}
			}).catch(error => {
				console.log(error);
			});
		} else {
			setModalMessage("Coin ID field must be filled out.");
		}
	}

	async function getHoldings() {
		let currency = await AsyncStorage.getItem("currency");
		if(empty(currency)) {
			currency = "usd";
		}
		
		let theme = empty(await AsyncStorage.getItem("theme")) ? "Light" : await AsyncStorage.getItem("theme");

		let api = await AsyncStorage.getItem("api");
		let token = await AsyncStorage.getItem("token");

		let endpoint = api + "holdings/read.php?platform=app&token=" + token;

		fetch(endpoint, {
			method: "GET",
			headers: {
				Accept: "application/json", "Content-Type": "application/json"
			}
		})
		.then((response) => {
			return response.json();
		})
		.then(async (coins) => {
			if(Object.keys(coins).length === 0) {
				if(navigation.isFocused()) {
					setHoldingsData([<Text key="empty" style={[styles.headerText, styles[`headerText${theme}`], { marginLeft:20 }]}>No Holdings Found.</Text>]);
					setHoldingsValue("-");
				}
			} else {
				parseHoldings(coins).then(holdings => {
					let data = [];

					data.push(
						<View style={styles.row} key={epoch() + "holdings-header"}>
							<Text style={[styles.headerText, styles[`headerText${theme}`], styles.headerRank]} ellipsizeMode="tail">#</Text>
							<Text style={[styles.headerText, styles[`headerText${theme}`], styles.headerCoin]} ellipsizeMode="tail">Coin</Text>
							<Text style={[styles.headerText, styles[`headerText${theme}`], styles.headerAmount]} ellipsizeMode="tail">Amount</Text>
							<Text style={[styles.headerText, styles[`headerText${theme}`], styles.headerValue]} ellipsizeMode="tail">Value</Text>
						</View>
					);

					let rank = 0;

					Object.keys(holdings).map(holding => {
						rank += 1;

						let coin = holdings[holding];

						let icon = coin.image;
						let amount = coin.amount;
						let symbol = coin.symbol;
						let value = separateThousands(abbreviateNumber(coin.value.toFixed(2), 2));

						data.push(
							<TouchableOpacity onPress={() => { setAction("update"); setCoinID(capitalizeFirstLetter(holding)); setCoinAmount(amount.toString()); setModal(true); }} key={epoch() + holding}>
								<View style={[styles.row, rank % 2 ? {...styles.rowOdd, ...styles[`rowOdd${theme}`]} : null]}>
									<Text style={[styles.cellText, styles[`cellText${theme}`], styles.cellRank]} ellipsizeMode="tail">{rank}</Text>
									<Image style={styles.cellImage} source={{uri:icon}}/>
									<Text style={[styles.cellText, styles[`cellText${theme}`], styles.cellSymbol]} ellipsizeMode="tail">{symbol}</Text>
									<Text style={[styles.cellText, styles[`cellText${theme}`], styles.cellAmount]} ellipsizeMode="tail">{separateThousands(amount)}</Text>
									<Text style={[styles.cellText, styles[`cellText${theme}`], styles.cellValue]} ellipsizeMode="tail">{currencies[currency] + value}</Text>
								</View>
							</TouchableOpacity>
						);
					});

					if(navigation.isFocused()) {
						setHoldingsData(data);
					}
				}).catch(e => {
					console.log(e);
				});
			}
		}).catch(error => {
			console.log(error);
		});
	}

	function parseHoldings(coins) {
		return new Promise(async (resolve, reject) => {
			try {
				let currency = await AsyncStorage.getItem("currency");
				if(empty(currency)) {
					currency = "usd";
				}

				let list = Object.keys(coins).join("%2C");

				let endpoint = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=" + currency + "&ids=" + list + "&order=market_cap_desc&per_page=250&page=1&sparkline=false";

				fetch(endpoint, {
					method: "GET",
					headers: {
						Accept: "application/json", "Content-Type": "application/json"
					}
				})
				.then((json) => {
					return json.json();
				})
				.then(async (response) => {
					let holdingsValue = 0;

					let holdings = {};

					Object.keys(response).map(index => {
						let coin = response[index];
						let id = coin.id;
						let price = coin.current_price;
						let amount = coins[id].amount;
						let value = price * amount;
						let priceChangeDay = coin.price_change_percentage_24h;

						if(!empty(priceChangeDay)) {
							priceChangeDay = priceChangeDay.toFixed(2);
						} else {
							priceChangeDay = "-";
						}

						holdings[id] = {
							symbol:coins[id].symbol.toUpperCase(),
							amount:amount,
							value:value,
							price:price,
							change:priceChangeDay,
							image:coin.image
						};

						holdingsValue += value;
					});

					if(holdingsValue > 0 && navigation.isFocused()) {
						let currency = await AsyncStorage.getItem("currency");
						if(empty(currency)) {
							currency = "usd";
						}
						
						if(screenWidth > 380) {
							setHoldingsValue(currencies[currency] + separateThousands(holdingsValue.toFixed(2)));
						} else {
							setHoldingsValue(currencies[currency] + abbreviateNumber(holdingsValue, 2));
						}
					}

					resolve(Object.fromEntries(
						Object.entries(holdings).sort(([,a],[,b]) => b.value - a.value)
					));
				}).catch(error => {
					console.log(error);
					reject(error);
				});
			} catch(error) {
				reject(error);
			}
		});
	}
}

String.prototype.replaceAll = function(str1, str2, ignore) {
	return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
}

const styles = StyleSheet.create({
	page: {
		height:screenHeight - 190,
		backgroundColor:globalColors["Light"].mainSecond,
	},
	pageDark: {
		backgroundColor:globalColors["Dark"].mainSecond
	},
	modalWrapper: {
		width:"100%",
		height:"100%",
		flex:1,
		justifyContent:"center",
		alignItems:"center",
		backgroundColor:globalColors["Light"].mainThird
	},
	modalWrapperDark: {
		backgroundColor:globalColors["Dark"].mainThird
	},
	modal: {
		width:300,
		height:300,
		alignItems:"center",
		backgroundColor:globalColors["Light"].mainFirst
	},
	modalDark: {
		backgroundColor:globalColors["Dark"].mainFirst
	},
	modalMessageWrapper: {
		backgroundColor:globalColors["Light"].accentFirst,
		borderRadius:globalStyles.borderRadius,
		width:screenWidth - 200,
		padding:10,
		marginTop:20,
	},
	modalMessage: {
		color:globalColors["Light"].accentContrast,
		fontSize:16,
		fontFamily:globalStyles.fontFamily,
		lineHeight:25,
	},
	input: {
		backgroundColor:globalColors["Light"].mainFirst,
		color:globalColors["Light"].mainContrast,
		shadowColor:globalStyles.shadowColor,
		shadowOffset:globalStyles.shadowOffset,
		shadowOpacity:globalStyles.shadowOpacity,
		shadowRadius:globalStyles.shadowRadius,
		elevation:globalStyles.shadowElevation,
		borderRadius:globalStyles.borderRadius,
		paddingLeft:10,
		paddingRight:10,
		marginBottom:20,
		width:screenWidth - 200,
	},
	inputDark: {
		backgroundColor:globalColors["Dark"].mainFirst,
		color:globalColors["Dark"].mainContrast
	},
	buttonWrapper: {
		width:screenWidth - 200,
		flexDirection:"row"
	},
	button: {
		height:40,
		width:((screenWidth - 200) / 2) - 10,
		shadowColor:globalStyles.shadowColor,
		shadowOffset:globalStyles.shadowOffset,
		shadowOpacity:globalStyles.shadowOpacity,
		shadowRadius:globalStyles.shadowRadius,
		elevation:globalStyles.shadowElevation,
		borderRadius:globalStyles.borderRadius,
		alignItems:"center",
		justifyContent:"center",
		borderRadius:globalStyles.borderRadius,
		backgroundColor:globalColors["Light"].mainContrast
	},
	buttonDark: {
		backgroundColor:globalColors["Dark"].mainFirst
	},
	buttonConfirm: {
		marginLeft:20,
		backgroundColor:globalColors["Light"].accentFirst
	},
	buttonConfirmDark: {
		backgroundColor:globalColors["Dark"].accentFirst
	},
	buttonDelete: {
		position:"absolute",
		bottom:100,
		backgroundColor:"rgb(230,50,50)",
		width:"auto",
		paddingLeft:14,
		paddingRight:14,
	},
	text: {
		lineHeight:38,
		fontFamily:globalStyles.fontFamily,
		fontSize:18,
		paddingBottom:2,
		color:globalColors["Light"].accentContrast
	},
	tableWrapper: {
		backgroundColor:globalColors["Light"].mainFirst,
		shadowColor:globalStyles.shadowColor,
		shadowOffset:globalStyles.shadowOffset,
		shadowOpacity:globalStyles.shadowOpacity,
		shadowRadius:globalStyles.shadowRadius,
		elevation:globalStyles.shadowElevation,
		borderRadius:globalStyles.borderRadius,
		height:screenHeight - 390,
		maxHeight:screenHeight - 390
	},
	tableWrapperDark: {
		backgroundColor:globalColors["Dark"].mainFirst
	},
	row: {
		flexDirection:"row",
		alignItems:"center",
		paddingTop:8,
		paddingBottom:8,
		paddingLeft:20,
	},
	rowOdd: {
		backgroundColor:globalColors["Light"].mainSecond,
	},
	rowOddDark: {
		backgroundColor:globalColors["Dark"].mainSecond,
	},
	loadingText: {
		marginLeft:20,
	},
	headerText: {
		fontSize:18,
		fontFamily:globalStyles.fontFamily,
		fontWeight:"bold",
		color:globalColors["Light"].mainContrastLight,
		marginBottom:4,
	},
	headerTextDark: {
		color:globalColors["Dark"].mainContrastLight
	},
	headerRank: {
		width:30
	},
	headerCoin: {
		width:100,
		marginLeft:15,
	},
	headerAmount: {
		width:100
	},
	cellText: {
		color:globalColors["Light"].mainContrastLight
	},
	cellTextDark: {
		color:globalColors["Dark"].mainContrastLight
	},
	cellRank: {
		width:30
	},
	cellSymbol: {
		width:74
	},
	cellAmount: {
		width:100,
	},
	cellImage: {
		width:30,
		height:30,
		marginRight:10,
		borderRadius:15,
	},
	card: {
		shadowColor:globalStyles.shadowColor,
		shadowOffset:globalStyles.shadowOffset,
		shadowOpacity:globalStyles.shadowOpacity,
		shadowRadius:globalStyles.shadowRadius,
		elevation:globalStyles.shadowElevation,
		borderRadius:globalStyles.borderRadius,
		justifyContent:"center",
		alignItems:"center",
		height:60,
	},
	cardText: {
		lineHeight:56,
		paddingBottom:4,
		fontSize:20,
		fontFamily:globalStyles.fontFamily,
		color:globalColors["Light"].accentContrast,
		fontWeight:"bold",
		textAlign:"center"
	},
	cardTextDark: {
		color:globalColors["Dark"].accentContrast
	}
});